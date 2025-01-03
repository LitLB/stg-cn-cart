// cart/src/utils/inventory.utils.ts

import type { InventoryEntry } from '@commercetools/platform-sdk';
import { readConfiguration } from '../utils/config.utils';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { createStandardizedError } from './error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

/**
 * Reusable Inventory Utility functions
 */
export class InventoryUtils {
    /**
     * Build the inventory key from channel + sku.
     * E.g., "onlineChannel-sku123"
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
}
