// cart/src/utils/inventory.utils.ts

import type { Cart, LineItem, InventoryEntry } from '@commercetools/platform-sdk';
import { readConfiguration } from './config.utils';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { createStandardizedError } from './error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export class InventoryUtils {
    /**
     * Build the inventory key from channel + sku.
     * E.g., "80000xxx-sku123"
     */
    public static buildInventoryKey(sku: string): string {
        const channelId = readConfiguration().onlineChannel;
        return `${channelId}-${sku}`;
    }

    /**
     * Fetch inventory by Key. Throw if not found.
     */
    public static async fetchInventoryByKeyOrThrow(inventoryKey: string): Promise<InventoryEntry> {
        const inventoryEntry = await CommercetoolsInventoryClient.getInventoryByKey(inventoryKey);
        if (!inventoryEntry) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: `No matching inventory for key=${inventoryKey}`,
            }, 'InventoryUtils.fetchInventoryByKeyOrThrow');
        }
        return inventoryEntry;
    }

    /**
     * Check if custom fields exist, else throw.
     */
    public static getCustomFieldsOrThrow(inventoryEntry: InventoryEntry): Record<string, any> {
        const customFields = inventoryEntry.custom?.fields;
        if (!customFields) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Missing custom fields on inventory entry.',
            }, 'InventoryUtils.getCustomFieldsOrThrow');
        }
        return customFields;
    }

    /**
     * A helper to extract `maxStock` and `totalUsed` from InventoryEntry custom fields.
     */
    public static getMaxStockAndTotalUsed(
        inventoryEntry: InventoryEntry,
        maximumKey: string,
        totalKey: string
    ): { maxStock: number | null; totalUsed: number } {
        const customFields = InventoryUtils.getCustomFieldsOrThrow(inventoryEntry);
        const maxStock = customFields[maximumKey] ?? null; // null => unlimited
        const totalUsed = customFields[totalKey] ?? 0;
        return { maxStock, totalUsed };
    }

    /**
     * Checks if new usage is allowed given the maxStock.
     * - Throws an error if `maxStock=0` or if `newUsage > maxStock`.
     * - If `maxStock` is null => unlimited => no error thrown.
     */
    public static validateNewUsage(maxStock: number | null, newUsage: number, errorContext: string): void {
        if (maxStock === 0) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'This product is currently not available (maxStock=0)',
            }, errorContext);
        }

        // If maxStock is null => unlimited. So skip.
        if (maxStock != null && newUsage > maxStock) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Exceeds maximum stock limit. usage=${newUsage}, max=${maxStock}.`,
            }, errorContext);
        }
    }

    /**
     * Finds a line item in the cart by SKU + supplyChannelId.
     */
    public static findLineItem(cart: Cart, sku: string, supplyChannelId: string): LineItem | undefined {
        return cart.lineItems.find((li: LineItem) => {
            return li.variant?.sku === sku && li.supplyChannel?.id === supplyChannelId;
        });
    }
}
