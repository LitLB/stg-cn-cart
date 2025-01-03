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

        // 3) read custom fields
        const customFields = InventoryUtils.getCustomFieldsOrThrow(inventoryEntry);

        const maxStock = customFields[maximumKey] ?? null;
        const totalUsed = customFields[totalKey] ?? 0;

        // 4) calculate new usage
        const newTotal = totalUsed + lineItem.quantity;

        // 5) if unlimited => skip
        if (maxStock == null) return;

        if (maxStock === 0) {
            // Should never happen if validated earlier
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'maxStock=0 => This product is currently not available',
            }, 'InventoryService.commitLineItemStockUsage');
        }

        if (newTotal > maxStock) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Cannot commit usage: newTotal ${newTotal} > maxStock ${maxStock}`,
            }, 'InventoryService.commitLineItemStockUsage');
        }

        // 6) update totalUsed
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
