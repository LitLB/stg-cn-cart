// server/adapters/ct-inventory-client.ts

import type { ApiRoot, InventoryEntry, InventoryEntryUpdate, InventoryEntryUpdateAction } from '@commercetools/platform-sdk';
import { readConfiguration } from '../utils/config.utils';
import CommercetoolsBaseClient from './ct-base-client'
import { HTTP_STATUSES } from '../constants/http.constant';

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
		const response = await this.apiRoot
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

	/**
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

	/**
	 * @param inventoryKey - The key of the inventory entry.
	 * @returns {Promise<InventoryEntry | null>} - Returns the inventory entry or null if not found.
	 */
	public async getInventoryByKey(inventoryKey: string): Promise<InventoryEntry | null> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.inventory()
				.withKey({ key: inventoryKey })
				.get()
				.execute();

			return response.body;
		} catch (error: any) {
			console.error('Error fetching inventory by Key:', error);
			return null;
		}
	}

	public async updateInventoryCustomField(
		inventoryEntry: InventoryEntry,
		fieldName: string,
		fieldValue: any
	): Promise<void> {
		const updateActions: InventoryEntryUpdateAction[] = [
			{
				action: 'setCustomField',
				name: fieldName,
				value: fieldValue,
			},
		];

		const inventoryUpdate: InventoryEntryUpdate = {
			version: inventoryEntry.version,
			actions: updateActions,
		};

		await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.inventory()
			.withId({ ID: inventoryEntry.id })
			.post({ body: inventoryUpdate })
			.execute();
	}

	public async updateInventoryDummyStock(inventoryEntry: InventoryEntry, orderedQuantity: number): Promise<void> {
		const dummyKey = 'dummyStock';
		const dummyPurchaseKey = 'dummyPurchase';

		if (!dummyKey || !dummyPurchaseKey) {
			throw {
				statusCode: HTTP_STATUSES.INTERNAL_SERVER_ERROR,
				statusMessage: 'dummyKey or dummyPurchaseKey invalid.',
				errorCode: "CUSTOM_INVENTORY_PROCESS_FAILED",
			}
		}
	

		const customFields = inventoryEntry.custom?.fields;
		if (!customFields) {
			throw {
				statusCode: HTTP_STATUSES.BAD_REQUEST,
				statusMessage: 'Custom fields are missing on inventory entry.',
				errorCode: "CUSTOM_INVENTORY_PROCESS_FAILED",
			}
		}

		const maximumStock = customFields[dummyKey];
		const totalPurchaseDummy = customFields[dummyPurchaseKey] || 0;


		const newTotal = totalPurchaseDummy + orderedQuantity;

		// Check if maximum stock is set and new total exceeds it.
		if(maximumStock !== undefined ) {
			if (newTotal > maximumStock) {
				throw {
					statusCode: HTTP_STATUSES.BAD_REQUEST,
					statusMessage: `Exceeds maximum stock allocation for journey [Dummy - Stock].`,
					errorCode: "CUSTOM_INVENTORY_PROCESS_FAILED",
				};
			}
		}

		await this.updateInventoryCustomField(
			inventoryEntry,
			dummyPurchaseKey,
			newTotal
		);

	}
}

export default CommercetoolsInventoryClient.getInstance();
