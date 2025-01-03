// cart/src/validators/inventory.validator.ts

import type { Cart, LineItem } from '@commercetools/platform-sdk';
import { HTTP_STATUSES } from '../constants/http.constant';
import { createStandardizedError } from '../utils/error.utils';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';

/**
 * InventoryValidator focuses on validation logic:
 *   - maxStock = 0 => Not sell
 *   - maxStock = null => Unlimited
 *   - maxStock > 0 => Check limit
 */
export class InventoryValidator {

    /**
     * 1) Validate a potential new item (not yet a lineItem).
     *    Called from "AddItem" scenario:
     *      - We only have SKU, quantity, the journey, and possibly supplyChannelId.
     */
    public static async validatePotentialItem(
        sku: string,
        quantity: number,
        journey: CART_JOURNEYS,
        supplyChannelId?: string
    ): Promise<void> {
        const journeyConfig = journeyConfigMap[journey];
        console.log('journeyConfig', journeyConfig);
        if (!journeyConfig?.inventory) {
            // If no special inventory config for this journey, skip
            return;
        }

        const { maximumKey, totalKey } = journeyConfig.inventory;

        // If supplyChannel is required, ensure we have one
        if (!supplyChannelId) {
            // Possibly fallback or throw if your business logic demands it
            // For demonstration, we'll just throw:
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Missing supplyChannelId for AddItem validation.',
            }, 'InventoryValidator.validatePotentialItem');
        }

        // 1) Fetch inventory for that sku or supplyChannel.
        //    If your system has a known way to derive inventoryId from SKU + channel,
        //    do that. We might also do: CommercetoolsInventoryClient.getInventory(sku)
        //    and find matching channel. For simplicity, let's assume we have an ID.
        //    If you store inventory key as (channelId + '-' + sku), adapt accordingly.

        // Example approach: we'll pretend "inventoryId" is the key:
        const inventoryId = await InventoryValidator.deriveInventoryId(sku, supplyChannelId);
        console.log('inventoryId', inventoryId);
        if (!inventoryId) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: `Cannot find inventory for sku=${sku} & channel=${supplyChannelId}`,
            }, 'InventoryValidator.validatePotentialItem');
        }

        // 2) Get the actual inventory entry
        const inventoryEntry = await CommercetoolsInventoryClient.getInventoryById(inventoryId);
        console.log('inventoryEntry', inventoryEntry);
        if (!inventoryEntry) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: `Inventory entry ${inventoryId} not found.`,
            }, 'InventoryValidator.validatePotentialItem');
        }

        // 3) Check custom fields
        const customFields = inventoryEntry.custom?.fields;
        console.log('customFields', customFields);
        if (!customFields) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Custom fields missing on inventory entry.',
            }, 'InventoryValidator.validatePotentialItem');
        }

        const maxStock = customFields[maximumKey] ?? null; // null => unlimited
        const totalUsed = customFields[totalKey] ?? 0;
        const newTotal = totalUsed + quantity;

        // 4) Evaluate
        if (maxStock === 0) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Cannot sell. maxStock=0',
            }, 'InventoryValidator.validatePotentialItem');
        }

        // if unlimited => pass
        if (maxStock == null) {
            return;
        }

        if (newTotal > maxStock) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Exceeds maxStock: newTotal=${newTotal}, max=${maxStock}`,
            }, 'InventoryValidator.validatePotentialItem');
        }
    }

    /**
     * 2) Validates a single *existing* lineItem in the cart.
     *    Typically used for "Update Quantity" or final cart check.
     */
    public static async validateLineItem(
        lineItem: LineItem,
        journey: CART_JOURNEYS
    ): Promise<void> {
        const journeyConfig = journeyConfigMap[journey];
        if (!journeyConfig?.inventory) {
            // If no special inventory config for this journey, skip
            return;
        }

        const { maximumKey, totalKey } = journeyConfig.inventory;

        // Check supplyChannel
        if (!lineItem.supplyChannel?.id) {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Missing supplyChannel on lineItem.',
            };
        }

        // Check inventoryId from lineItem
        const inventoryId =
            lineItem.variant.availability?.channels?.[lineItem.supplyChannel.id]?.id;
        if (!inventoryId) {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'InventoryId not found on lineItem.',
            };
        }

        // Fetch inventory
        const inventoryEntry = await CommercetoolsInventoryClient.getInventoryById(inventoryId);
        if (!inventoryEntry) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: `Inventory entry ${inventoryId} not found.`,
            };
        }

        // Check custom fields
        const customFields = inventoryEntry.custom?.fields;
        if (!customFields) {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Custom fields missing on inventory entry.',
            };
        }

        const maxStock = customFields[maximumKey] ?? null;
        const totalUsed = customFields[totalKey] ?? 0;
        const newTotal = totalUsed + lineItem.quantity;

        // 0 => block
        if (maxStock === 0) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Cannot sell. maxStock = 0.',
            }, 'InventoryValidator.validateLineItem');
        }

        // null => unlimited => pass
        if (maxStock == null) {
            return;
        }

        // positive => check limit
        if (newTotal > maxStock) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Exceeds maxStock: ${newTotal} > ${maxStock}.`,
            }, 'InventoryValidator.validateLineItem');
        }
    }

    /**
     * 3) Validate the entire cart (for final check).
     */
    public static async validateCart(ctCart: Cart): Promise<void> {
        const journey = ctCart.custom?.fields?.journey as CART_JOURNEYS;
        if (!journey) {
            // No journey => skip
            return;
        }

        // Validate each lineItem
        for (const lineItem of ctCart.lineItems) {
            await InventoryValidator.validateLineItem(lineItem, journey);
        }
    }

    /**
     * (Helper) Example method that tries to figure out
     *  your "inventoryId" from (sku, supplyChannelId).
     *  The logic might differ depending on your CT setup.
     */
    private static async deriveInventoryId(sku: string, supplyChannelId: string): Promise<string | null> {
        // For example, if your Inventory key = channel + '-' + sku, do:
        //   key = supplyChannelId + '-' + sku
        //   then query CommercetoolsInventoryClient by key
        // This is just a placeholder
        const possibleInventories = await CommercetoolsInventoryClient.getInventory(sku);
        if (!possibleInventories?.length) {
            return null;
        }
        // Filter to the one matching supplyChannel
        const match = possibleInventories.find((inv: any) => {
            // e.g., maybe inv.channelId === supplyChannelId
            return inv.supplyChannel === supplyChannelId;
        });
        return match?.id || null;
    }
}
