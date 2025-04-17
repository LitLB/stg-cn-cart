// cart/src/services/inventory.service.ts

import type { Cart, LineItem } from '@commercetools/platform-sdk';
import { createStandardizedError } from '../utils/error.utils';
import { CART_INVENTORY_MODES, CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { HTTP_STATUSES } from '../constants/http.constant';
import { InventoryUtils } from '../utils/inventory.utils';

export class InventoryService {
    public async commitLineItemStockUsage(lineItem: LineItem, journey: CART_JOURNEYS) {
        const isMainProduct = lineItem.custom?.fields?.productType === 'main_product';
        const isPreOrder = lineItem.custom?.fields?.isPreOrder;
        console.log('isMainProduct', isMainProduct);
        console.log('isPreOrder', isPreOrder);

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

        if (isPreOrder && isMainProduct) {
            // Update Dummy Stock.
            console.log('[InventoryService] Using dummy stock for isPreOrder main_product');
            await CommercetoolsInventoryClient.updateInventoryDummyStock(
                inventoryEntry,
                lineItem.quantity,
            );
        }

        if (journey !== CART_JOURNEYS.SINGLE_PRODUCT) {
            const journeyConfig = journeyConfigMap[journey];
            if (!journeyConfig?.inventory) {
                // No special inventory config => skip
                return;
            }

            const { maximumKey, totalKey } = journeyConfig.inventory;

            // Get Inventory Entry
            const refetchedInventoryEntry = await CommercetoolsInventoryClient.getInventoryById(inventoryId);
            if (!refetchedInventoryEntry) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: `Refetched Inventory entry ${inventoryId} not found.`,
                }, 'InventoryService.commitLineItemStockUsage');
            }

            // Get Stock Allocation of Journey by Key
            const { maxStock, totalUsed } = InventoryUtils.getMaxStockAndTotalUsed(
                inventoryEntry,
                maximumKey,
                totalKey
            );
            console.log('maximumKey', maximumKey);
            console.log('totalKey', totalKey);

            // calculate new usage
            const newTotal = totalUsed + lineItem.quantity;
            console.log('maxStock', maxStock);
            console.log('totalUsed', totalUsed);
            console.log('newTotal', newTotal);

            // maxStock = 0, validate new usage (throws if invalid)
            InventoryUtils.validateNewUsage(
                maxStock,
                newTotal,
                'InventoryService.commitLineItemStockUsage'
            );

            // update totalUsed
            if (totalKey) {
                await CommercetoolsInventoryClient.updateInventoryCustomField(
                    refetchedInventoryEntry,
                    totalKey,
                    newTotal
                );
            }
        }
    }

    /**
     * Commits usage for all lineItems in the cart at checkout.
     */
    public async commitCartStock(ctCart: Cart): Promise<void> {
        const journey = ctCart.custom?.fields?.journey as CART_JOURNEYS;
        if (!journey) return;

        for (const lineItem of ctCart.lineItems) {
            const itemJourney = (lineItem.custom?.fields?.journey as CART_JOURNEYS) || journey;
            const productType = lineItem.custom?.fields?.productType;
            const inventoryMode = lineItem.inventoryMode;
            if (productType !== 'bundle' && (productType === 'sim' && inventoryMode === CART_INVENTORY_MODES.RESERVE_ON_ORDER)) await this.commitLineItemStockUsage(lineItem, itemJourney);
        }
    }
}
