// cart/src/validators/inventory.validator.ts

import type { Cart, LineItem } from '@commercetools/platform-sdk';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import { readConfiguration } from '../utils/config.utils';
import { InventoryUtils } from '../utils/inventory.utils';

export class InventoryValidator {
    /**
     * A single method to validate line item stock, for both “Add/Upsert” or “Replace” flows.
     * 
     * @param cart - The current cart
     * @param sku - The SKU we’re modifying
     * @param finalDesiredQty - The total quantity we want in the cart for this SKU
     * @param journey - The cart’s journey
     * @param existingQtyInCart - If you already computed how many of this SKU are in the cart. 
     *                            If not passed, we’ll find it ourselves.
     */
    public static async validateLineItemStock(
        cart: Cart,
        sku: string,
        finalDesiredQty: number,
        journey: CART_JOURNEYS,
        existingQtyInCart?: number
    ): Promise<void> {
        // 1) If no inventory config, skip
        const journeyConfig = journeyConfigMap[journey];
        if (!journeyConfig?.inventory) {
            return;
        }

        const { maximumKey, totalKey } = journeyConfig.inventory;
        const supplyChannelId = readConfiguration().ctpSupplyChannel;

        // 2) If we don’t have existingQtyInCart, find it
        let existingQty = existingQtyInCart ?? 0;
        if (existingQty === 0 && existingQtyInCart == null) {
            const existingLineItem = cart.lineItems.find((li: LineItem) => {
                return li.variant?.sku === sku && li.supplyChannel?.id === supplyChannelId;
            });
            if (existingLineItem) {
                existingQty = existingLineItem.quantity;
            }
        }

        // final total in the cart
        // (“Add” = existingQty + user’s request, or “Replace” = user’s final requested qty)
        const newRequestedTotal = finalDesiredQty;

        // 3) fetch inventory
        const inventoryKey = InventoryUtils.buildInventoryKey(sku);
        const inventoryEntry = await InventoryUtils.fetchInventoryByKeyOrThrow(inventoryKey);

        // 4) read custom fields
        const customFields = InventoryUtils.getCustomFieldsOrThrow(inventoryEntry);

        const maxStock = customFields[maximumKey] ?? null;  // null => unlimited
        const totalUsed = customFields[totalKey] ?? 0;

        // e.g. newTotalUsage = totalUsed + (newRequestedTotal) 
        // If your logic requires partial differences, adapt here
        const newTotalUsage = totalUsed + newRequestedTotal;

        // 5) check logic
        if (maxStock === 0) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'This product is currently not available (maxStock=0)',
            }, 'InventoryValidator.validateLineItemStock');
        }
        if (maxStock == null) {
            // unlimited => pass
            return;
        }
        if (newTotalUsage > maxStock) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Exceeds maximum stock limit. usage=${newTotalUsage}, max=${maxStock}.`,
            }, 'InventoryValidator.validateLineItemStock');
        }
    }

    /**
     * Convenience wrappers if you prefer separate calls 
     */
    public static async validateLineItemUpsert(cart: Cart, sku: string, requestedQty: number, journey: CART_JOURNEYS) {
        // Upsert means existing + requested
        let existingQty = 0;
        const supplyChannelId = readConfiguration().ctpSupplyChannel;
        const lineItem = cart.lineItems.find(
            (li) => li.variant?.sku === sku && li.supplyChannel?.id === supplyChannelId
        );
        if (lineItem) existingQty = lineItem.quantity;

        const finalDesiredQty = existingQty + requestedQty;
        await InventoryValidator.validateLineItemStock(cart, sku, finalDesiredQty, journey, existingQty);
    }

    public static async validateLineItemReplaceQty(cart: Cart, sku: string, finalQty: number, journey: CART_JOURNEYS) {
        // Replace means final = new qty
        await InventoryValidator.validateLineItemStock(cart, sku, finalQty, journey);
    }

    /**
     * Example method for validating entire cart before final checkout
     */
    public static async validateCart(cart: Cart): Promise<void> {
        const journey = cart.custom?.fields?.journey as CART_JOURNEYS;
        if (!journey) return;

        for (const lineItem of cart.lineItems) {
            if (!lineItem.variant?.sku) continue;
            await InventoryValidator.validateLineItemStock(
                cart,
                lineItem.variant.sku,
                lineItem.quantity,
                journey
            );
        }
    }
}
