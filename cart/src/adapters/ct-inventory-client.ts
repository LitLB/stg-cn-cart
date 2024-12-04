// server/adapters/ct-inventory-client.ts

import type { ApiRoot, InventoryEntry, InventoryEntryUpdateAction } from '@commercetools/platform-sdk';
import { readConfiguration } from '../utils/config.utils';
import CommercetoolsBaseClient from './ct-base-client'

class CommercetoolsInventoryClient {
	private static instance: CommercetoolsInventoryClient;
	private apiRoot: ApiRoot;
	private projectKey: string;
	private onlineChannel: string;

	private constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
		this.onlineChannel = readConfiguration().onlineChannel as string;
	}

	public static getInstance(): CommercetoolsInventoryClient {
		if (!CommercetoolsInventoryClient.instance) {
			CommercetoolsInventoryClient.instance = new CommercetoolsInventoryClient();
		}
		return CommercetoolsInventoryClient.instance;
	}

	/**
	 * Fetches inventory by ID.
	 * @param inventoryId - The ID of the inventory entry.
	 * @returns {Promise<InventoryEntry | null>} - Returns the inventory entry or null if not found.
	 */
	public async getInventoryById(inventoryId: string): Promise<InventoryEntry | null> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.inventory()
				.withId({ ID: inventoryId })
				.get()
				.execute();

			return response.body;
		} catch (error: any) {
			console.error('Error fetching inventory by ID:', error);
			return null;
		}
	}

	// public async updateInventoryAllocation(
	// 	inventoryId: string,
	// 	version: number,
	// 	newTotalPurchaseAllocation: number
	// ): Promise<InventoryEntry> {
	// 	const updateActions: InventoryEntryUpdateAction[] = [
	// 		{
	// 			action: 'setCustomField',
	// 			name: 'totalPurchaseStockAllocationDeviceOnly',
	// 			value: newTotalPurchaseAllocation,
	// 		},
	// 	];

	// 	try {
	// 		const response = await this.apiRoot
	// 			.withProjectKey({ projectKey: this.projectKey })
	// 			.inventory()
	// 			.withId({ ID: inventoryId })
	// 			.post({ body: { version, actions: updateActions } })
	// 			.execute();

	// 		return response.body as InventoryEntry;
	// 	} catch (error: any) {
	// 		console.error('Error updating inventory allocation:', error);
	// 		throw error;
	// 	}
	// }

	/**
  * Updates the inventory allocation with retry logic to handle version conflicts.
  * @param inventoryId - The ID of the inventory entry.
  * @param orderedQuantity - The quantity being ordered.
  * @param maxRetries - Maximum number of retry attempts.
  * @returns {Promise<InventoryEntry>} - Returns the updated inventory entry.
  */
	public async updateInventoryAllocation(
		inventoryId: string,
		orderedQuantity: number,
	): Promise<InventoryEntry> {
		// Fetch the latest inventory entry
		const inventoryEntry = await this.getInventoryById(inventoryId);
		if (!inventoryEntry) {
			throw new Error(`Inventory with ID ${inventoryId} not found.`);
		}

		const version = inventoryEntry.version;
		const customFields = inventoryEntry.custom?.fields;
		const currentTotalPurchaseAllocation = customFields?.totalPurchaseStockAllocationDeviceOnly || 0;
		const maximumStockAllocation = customFields?.maximumStockAllocationDeviceOnly || 0;

		const newTotalPurchaseAllocation = currentTotalPurchaseAllocation + orderedQuantity;

		// Validate allocation
		if (newTotalPurchaseAllocation > maximumStockAllocation) {
			throw new Error('Device Out of Stock.');
		}

		const updateActions: InventoryEntryUpdateAction[] = [
			{
				action: 'setCustomField',
				name: 'totalPurchaseStockAllocationDeviceOnly',
				value: newTotalPurchaseAllocation,
			},
		];

		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.inventory()
			.withId({ ID: inventoryId })
			.post({ body: { version, actions: updateActions } })
			.execute();

		return response.body as InventoryEntry;
	}

	/**
	 * get stock available of inventory.
	 * @param inventory - The inventory of the product.
	 * @returns {Promise<Number>} - Returns data avaliable of inventory.
	 */
	public checkStockAvailable(inventory: any): number {
		let totalAvailableStock = 0;
		if (!inventory) {
			return totalAvailableStock;
		}
		const customData = inventory.custom;

		if (inventory?.custom?.fields?.stockStatus === "Inactive") {
			return totalAvailableStock;
		}

		const stockActiveDate = new Date(inventory?.custom?.fields?.stockActiveDate);
		const now = new Date();

		if (stockActiveDate > now) {
			return totalAvailableStock;
		}

		const availableQuantityAfterSafetyStock = inventory?.availableQuantity - (inventory?.custom?.fields?.safetyStock || 0);
		if (availableQuantityAfterSafetyStock <= 0) {
			return totalAvailableStock;
		}

		totalAvailableStock += availableQuantityAfterSafetyStock;

		return totalAvailableStock;
	}

	/**
	 * get stock dummy of Inventory.
	 * @param inventory - The inventory of the product.
	 * @returns {Promise<Array>} - Returns data dummy and dummy purchase.
	 */
	public checkStockDummy(inventory: any): { totalAvailableDummyStock: number, totalAvailableDummyPurchaseStock: number } {
		let totalAvailableDummyStock = 0;
		let totalAvailableDummyPurchaseStock = 0;
		if (!inventory) {
			return { totalAvailableDummyStock, totalAvailableDummyPurchaseStock };
		}
		if (inventory?.custom?.fields?.stockStatus === "Inactive") {
			return { totalAvailableDummyStock, totalAvailableDummyPurchaseStock };
		}

		const stockActiveDate = new Date(inventory?.custom?.fields?.stockActiveDate);
		const now = new Date();

		if (stockActiveDate > now) {
			return { totalAvailableDummyStock, totalAvailableDummyPurchaseStock };
		}

		let dummyStockAfterSafetyStock = inventory?.custom?.fields?.dummyStock - (inventory?.custom?.fields?.safetyStock || 0);
		if (dummyStockAfterSafetyStock <= 0) {
			return { totalAvailableDummyStock, totalAvailableDummyPurchaseStock };
		}

		const availableQuantity = inventory?.availableQuantity || 0
		if (availableQuantity > 0) {
			dummyStockAfterSafetyStock = 0
		}

		totalAvailableDummyStock += dummyStockAfterSafetyStock || 0;
		totalAvailableDummyPurchaseStock += inventory?.custom?.fields?.dummyPurchase || 0;

		return { totalAvailableDummyStock, totalAvailableDummyPurchaseStock };
	}

	/**
	 * Checks is out of stock of SKU.
	 * @param stock - The stock of the inventory.
	 * @returns {Promise<Boolean>} - Returns true if sufficient stock is outstock.
	 */
	public checkIsOutOfStockPerInventory(stock: any): boolean {
		if (stock.available > 0) stock.totalAvailableDummyStock = 0
		const checkAvailabelAndDummy = stock.available == 0 && stock.totalAvailableDummyStock == 0
		return (checkAvailabelAndDummy) ? checkAvailabelAndDummy : stock.available <= 0 && stock.totalAvailableDummyStock >= 0 && (stock.totalAvailableDummyStock == stock.totalAvailableDummyPurchaseStock)
	}
	/**
	 * generateKey
	 * @param skus - The skus of the inventory.
	 * @returns {Promise<any>} - Returns array of key.
	 */
	public generateKey(skus: any) {
		const shopCode = this.onlineChannel
		return skus ? Object.values(skus).map((sku: any) => {
			return shopCode + '-' + sku;
		}) : []
	}

	/**
	 * get inventory.
	 * @param skus - The key of the inventory.
	 * @returns {Promise<any>} - Returns data inventory
	 */
	public async getInventory(skus: any): Promise<any> {
		const skusArray = skus.split(",")
		const keys = this.generateKey(skusArray)
		const expand = `key in (${keys.map((id: any) => `"${id}"`).join(",")})`;
		let response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.inventory()
			.get({ queryArgs: { where: expand } })
			.execute();

		const inventoryItems = response.body.results;
		const updatedDataInventories: any = [];

		// const filteredInventories = inventoryItems.filter((inventory: any) => {
		// 	return inventory?.custom?.fields?.stockStatus === 'Active';
		// });

		inventoryItems.forEach((inventory) => {
			const available = this.checkStockAvailable(inventory);
			const dummy = this.checkStockDummy(inventory);
			const compareAvailable = { available, ...dummy }
			const isOutOfStock = this.checkIsOutOfStockPerInventory(compareAvailable);
			updatedDataInventories.push({
				...inventory,
				stock: compareAvailable,
				isOutOfStock: isOutOfStock
			});
		})

		return updatedDataInventories
	}
}

export default CommercetoolsInventoryClient.getInstance();
