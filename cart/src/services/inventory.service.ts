// cart/src/services/inventory.service.ts

import type { Cart, LineItem } from '@commercetools/platform-sdk';
import { createStandardizedError } from '../utils/error.utils';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { InventoryValidator } from '../validators/inventory.validator';
import { HTTP_STATUSES } from '../constants/http.constant';

/**
 * InventoryService: 
 *   - Commits (updates) custom fields when a sale is confirmed (if not unlimited).
 *   - Possibly restore usage if line items are removed, etc. (optional).
 */
export class InventoryService {
    /**
     * "Commit" the usage for a single lineItem after finalizing or at checkout.
     */
    public async commitLineItemStockUsage(lineItem: LineItem, journey: CART_JOURNEYS) {
        const journeyConfig = journeyConfigMap[journey];
        if (!journeyConfig?.inventory) {
            // no config => do nothing
            return;
        }

        const { maximumKey, totalKey } = journeyConfig.inventory;
        const supplyChannelId = lineItem.supplyChannel?.id;
        if (!supplyChannelId) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Missing supplyChannel on lineItem.',
            }, 'InventoryService.commitLineItemStockUsage');
        }

        const inventoryId = lineItem.variant.availability?.channels?.[supplyChannelId]?.id;
        if (!inventoryId) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'InventoryId not found on lineItem.',
            }, 'InventoryService.commitLineItemStockUsage');
        }

        const inventoryEntry = await CommercetoolsInventoryClient.getInventoryById(inventoryId);
        if (!inventoryEntry) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: `Inventory entry ${inventoryId} not found.`,
            }, 'InventoryService.commitLineItemStockUsage');
        }

        const customFields = inventoryEntry.custom?.fields;
        if (!customFields) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Missing custom fields on inventory entry.',
            }, 'InventoryService.commitLineItemStockUsage');
        }

        const maxStock = customFields[maximumKey] ?? null; // null => unlimited
        const totalUsed = customFields[totalKey] ?? 0;
        const newTotal = totalUsed + lineItem.quantity;

        // If unlimited => skip
        if (maxStock == null) return;

        // If maxStock=0 => should never happen if validated properly
        if (maxStock === 0) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'maxStock=0 => not sell. This should have been blocked earlier.',
            }, 'InventoryService.commitLineItemStockUsage');
        }

        // If newTotal > maxStock => also shouldn't happen if validated properly
        if (newTotal > maxStock) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Cannot commit usage: newTotal ${newTotal} > maxStock ${maxStock}`,
            }, 'InventoryService.commitLineItemStockUsage');
        }

        // If OK, update totalUsed
        await CommercetoolsInventoryClient.setCustomField(
            inventoryEntry.id,
            inventoryEntry.version,
            totalKey,
            newTotal
        );
    }

    /**
     * Commits usage for all lineItems in the cart at checkout.
     */
    public async commitCartStock(ctCart: Cart): Promise<void> {
        const journey = ctCart.custom?.fields?.journey as CART_JOURNEYS;
        if (!journey) return;

        // Before committing, let's do a final validation
        await InventoryValidator.validateCart(ctCart);

        // Then commit each lineItem
        for (const lineItem of ctCart.lineItems) {
            await this.commitLineItemStockUsage(lineItem, journey);
        }
    }
}
