// cart/src/validators/inventory.validator.ts

import type { Cart } from '@commercetools/platform-sdk';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import { readConfiguration } from '../utils/config.utils';
import { InventoryUtils } from '../utils/inventory.utils';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export class InventoryValidator {
    /**
     * A single method to validate line item stock, for both “Add/Upsert” or “Replace” flows.
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

        // 2) If existingQtyInCart not exists, find it
        let existingQty = existingQtyInCart ?? 0;
        if (existingQty === 0 && existingQtyInCart == null) {
            const existingLineItem = InventoryUtils.findLineItem(cart, sku, supplyChannelId);
            if (existingLineItem) {
                existingQty = existingLineItem.quantity;
            }
        }

        // “Add” = existingQty + user’s request, or “Replace” = user’s final requested qty
        const newRequestedTotal = finalDesiredQty;

        // 3) fetch inventory
        const inventoryKey = InventoryUtils.buildInventoryKey(sku);
        const inventoryEntry = await InventoryUtils.fetchInventoryByKeyOrThrow(inventoryKey);

        // 4) read custom fields
        const { maxStock, totalUsed } = InventoryUtils.getMaxStockAndTotalUsed(
            inventoryEntry,
            maximumKey,
            totalKey
        );

        // e.g. newTotalUsage = totalUsed + newRequestedTotal
        const newTotalUsage = totalUsed + newRequestedTotal;
        console.log('maxStock', maxStock);
        console.log('totalUsed', totalUsed);
        console.log('newTotalUsage', newTotalUsage);

        // 5) validate new usage
        InventoryUtils.validateNewUsage(
            maxStock,
            newTotalUsage,
            'InventoryValidator.validateLineItemStock'
        );
    }

    /**
     * Convenience wrapper for "Upsert" flow: (existing + requested)
     */
    public static async validateLineItemUpsert(
        cart: Cart,
        sku: string,
        requestedQty: number,
        journey: CART_JOURNEYS
    ) {
        let existingQty = 0;
        const supplyChannelId = readConfiguration().ctpSupplyChannel;
        const lineItem = InventoryUtils.findLineItem(cart, sku, supplyChannelId);
        if (lineItem) existingQty = lineItem.quantity;

        const finalDesiredQty = existingQty + requestedQty;
        await InventoryValidator.validateLineItemStock(cart, sku, finalDesiredQty, journey, existingQty);
    }

    /**
     * Convenience wrapper for "Replace" flow: (final = new qty)
     */
    public static async validateLineItemReplaceQty(
        cart: Cart,
        sku: string,
        finalQty: number,
        journey: CART_JOURNEYS
    ) {
        await InventoryValidator.validateLineItemStock(cart, sku, finalQty, journey);
    }

    /**
     * Method for validating entire cart before final checkout
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

    public static async validateSafetyStock(cart: Cart): Promise<void> {

        console.log(' ============== START SAFETY STOCK ============== ');
        const supplyChannelId = readConfiguration().ctpSupplyChannel;

        for (const lineItem of cart.lineItems) {
            if (!lineItem.variant?.sku) continue;

            const sku = lineItem.variant.sku
            const existingLineItem = InventoryUtils.findLineItem(cart, sku, supplyChannelId);
            const lineItemQuantity = existingLineItem?.quantity ?? 0

            const inventoryKey = InventoryUtils.buildInventoryKey(sku);
            const inventoryEntry = await InventoryUtils.fetchInventoryByKeyOrThrow(inventoryKey);

            const customFields = inventoryEntry.custom?.fields

            const availableQuantity = inventoryEntry.availableQuantity
            const safetyStock = customFields?.safetyStock || 0

            const realQuantity = availableQuantity - safetyStock

            if (realQuantity < lineItemQuantity) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    errorCode: 'INVENTORY_ERROR',
                    data: {
                        message: `Safety stock exceeded for SKU: ${sku}`,
                        availableQuantity,
                        safetyStock,
                        quantityAfterCheckSafetyStock: realQuantity,
                        itemQuantity: lineItemQuantity
                    }
                })
            }
        }

        console.log(' ============== END SAFETY STOCK ============== ');
    }

}
