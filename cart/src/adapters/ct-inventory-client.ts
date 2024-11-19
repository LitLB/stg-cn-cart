// server/adapters/ct-inventory-client.ts

import type { ApiRoot } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';

class CommercetoolsInventoryClient {
	private static instance: CommercetoolsInventoryClient;
	private apiRoot: ApiRoot;
	private projectKey: string;
	private onlineChannel: string;

	private constructor() {
		const config = useRuntimeConfig();
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = config.public.ctpProjectKey as string;
		this.onlineChannel = config.onlineChannel as string;
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
