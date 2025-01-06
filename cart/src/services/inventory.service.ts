// cart/src/services/inventory.service.ts

import type { Cart, LineItem } from '@commercetools/platform-sdk';
import { createStandardizedError } from '../utils/error.utils';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { HTTP_STATUSES } from '../constants/http.constant';
import { InventoryUtils } from '../utils/inventory.utils';

export class InventoryService {
    public async commitLineItemStockUsage(lineItem: LineItem, journey: CART_JOURNEYS) {
        const journeyConfig = journeyConfigMap[journey];
        if (!journeyConfig?.inventory) {
            // No special inventory config => skip
            return;
        }

        // TODO: Max's code
        // const preOrder = cart?.custom?.preOrder;

        const { maximumKey, totalKey } = journeyConfig.inventory;

        // 1) get supplyChannel + inventoryId
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

        // 2) fetch from CT
        const inventoryEntry = await CommercetoolsInventoryClient.getInventoryById(inventoryId);
        if (!inventoryEntry) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: `Inventory entry ${inventoryId} not found.`,
            }, 'InventoryService.commitLineItemStockUsage');
        }

        // 3) read custom fields to get maxStock & totalUsed
        const { maxStock, totalUsed } = InventoryUtils.getMaxStockAndTotalUsed(
            inventoryEntry,
            maximumKey,
            totalKey
        );
        console.log('maximumKey', maximumKey);
        console.log('totalKey', totalKey);

        // 4) calculate new usage
        const newTotal = totalUsed + lineItem.quantity;
        console.log('maxStock', maxStock);
        console.log('totalUsed', totalUsed);
        console.log('newTotal', newTotal);

        // 5) if unlimited => skip
        if (maxStock == null) return;

        // 6) validate new usage (throws if invalid)
        InventoryUtils.validateNewUsage(
            maxStock,
            newTotal,
            'InventoryService.commitLineItemStockUsage'
        );

        // 7) update totalUsed
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

        for (const lineItem of ctCart.lineItems) {
            await this.commitLineItemStockUsage(lineItem, journey);
        }
    }
}
