import { LineItem } from '@commercetools/platform-sdk';
// src/server/adapters/ct-product-client.ts

import type { ApiRoot, Cart, Product, ProductDraft, ProductVariant } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from '../adapters/ct-base-client';
import { CT_PRODUCT_ACTIONS } from '../constants/ct.constant';
import { readConfiguration } from '../utils/config.utils';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client'
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';

class CommercetoolsProductClient {
	private static instance: CommercetoolsProductClient;
	private apiRoot: ApiRoot;
	private projectKey: string;
	private readonly ctInventoryClient;


	private constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
		this.ctInventoryClient = CommercetoolsInventoryClient;
	}

	public static getInstance(): CommercetoolsProductClient {
		if (!CommercetoolsProductClient.instance) {
			CommercetoolsProductClient.instance = new CommercetoolsProductClient();
		}
		return CommercetoolsProductClient.instance;
	}

	async createProduct(productDraft: ProductDraft): Promise<Product> {
		const product = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.products()
			.post({ body: productDraft })
			.execute();

		return product.body;
	}

	async getProductById(id: string): Promise<Product> {
		const product = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.products()
			.withId({ ID: id })
			.get()
			.execute();

		return product.body;
	}

	async getProductByKey(key: string): Promise<Product> {
		const product = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.products()
			.withKey({ key: key })
			.get()
			.execute();

		return product.body;
	}

	async getProductByAkeneoId(akeneoIds: any[]): Promise<any> {
		let search = ''
		const products = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.products()
			.get({
				queryArgs: {
					where: search.concat(`masterData(staged(variants(attributes(name="akeneo_id" and value in (${akeneoIds}))))) or masterData(staged(masterVariant(attributes(name="akeneo_id" and value in (${akeneoIds})))))`)
				},
			})
			.execute();

		return products;
	}

	async updateProduct(id: string, updateActions: any): Promise<Product> {
		const product = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.products()
			.withId({ ID: id })
			.post({
				body: {
					version: updateActions.version,
					actions: updateActions.actions,
				},
			})
			.execute();

		return product.body;
	}

	async deleteProduct(id: string, version: number): Promise<Product> {
		const product = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.products()
			.withId({ ID: id })
			.delete({ queryArgs: { version } })
			.execute();

		return product.body;
	}

	async publishProduct(id: string, version: number): Promise<Product> {
		const updateActions = {
			version,
			actions: [{ action: CT_PRODUCT_ACTIONS.PUBLISH }],
		};
		const product = await this.updateProduct(id, updateActions);
		return product;
	}

	async unpublishProduct(id: string, version: number): Promise<Product> {
		const updateActions = {
			version,
			actions: [{ action: CT_PRODUCT_ACTIONS.UNPUBLISH }],
		};
		const product = await this.updateProduct(id, updateActions);
		return product;
	}

	findVariantBySku(product: Product, sku: string): ProductVariant | null {
		const currentData = product.masterData.current;
		const variants = [currentData.masterVariant, ...currentData.variants];
		const variant = variants.find((v) => v.sku === sku);
		return variant || null;
	}

	async getProductsBySkus(skus: any[]): Promise<any> {
		const filter = `variants.sku: ${skus.map(sku => `"${sku}"`).join(',')}`
		const products = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.productProjections()
			.search()
			.get({
				queryArgs: {
					filter
				}
			}).execute()

		return products;
	}

	async getProductsByIds(productIds: any[]) {
		const filter = `id: ${productIds.map(productId => `"${productId}"`).join(',')}`
		const products = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.productProjections()
			.search()
			.get({
				queryArgs: {
					'filter.query': filter
				}
			}).execute()

		return products;
	}

	findValidPrice({
		prices,
		customerGroupId,
		date = new Date(),
	}: {
		prices: any[];
		customerGroupId: string;
		date?: Date;
	}): any | null {
		// Filter prices matching the customer group and valid at the given date
		const validPrices = prices.filter((price) => {
			const priceCustomerGroupId = price.customerGroup?.id;
			if (priceCustomerGroupId !== customerGroupId) {
				return false;
			}
			const validFrom = price.validFrom ? new Date(price.validFrom) : null;
			const validUntil = price.validUntil ? new Date(price.validUntil) : null;

			// Check if the price is valid for the current date
			if (validFrom && date < validFrom) {
				return false;
			}
			if (validUntil && date > validUntil) {
				return false;
			}
			return true;
		});

		if (validPrices.length === 0) {
			return null;
		}

		// Sort valid prices based on priority rules
		const sortedPrices = validPrices.sort((a, b) => {
			const aHasValidDates = a.validFrom && a.validUntil;
			const bHasValidDates = b.validFrom && b.validUntil;

			// Prefer prices with validFrom and validUntil
			if (aHasValidDates && !bHasValidDates) {
				return -1; // `a` comes before `b`
			}
			if (!aHasValidDates && bHasValidDates) {
				return 1; // `b` comes before `a`
			}

			// If both have valid dates, compare validFrom
			if (aHasValidDates && bHasValidDates) {
				const aValidFrom = new Date(a.validFrom);
				const bValidFrom = new Date(b.validFrom);
				if (aValidFrom < bValidFrom) {
					return -1;
				}
				if (aValidFrom > bValidFrom) {
					return 1;
				}

				// If validFrom dates are equal, compare centAmount
				const aCentAmount = a.value.centAmount;
				const bCentAmount = b.value.centAmount;
				if (aCentAmount < bCentAmount) {
					return -1;
				}
				if (aCentAmount > bCentAmount) {
					return 1;
				}

				// If centAmount is equal, consider as equal
				return 0;
			}

			// If neither has valid dates or both don't have valid dates, compare centAmount
			const aCentAmount = a.value.centAmount;
			const bCentAmount = b.value.centAmount;
			if (aCentAmount < bCentAmount) {
				return -1;
			}
			if (aCentAmount > bCentAmount) {
				return 1;
			}

			// If centAmount is equal, consider as equal
			return 0;
		});

		// Return the price with the highest priority
		return sortedPrices[0];
	}

	findVariantByKey(variantKey: string, masterVariant: ProductVariant, variants: ProductVariant[]) {
		const allVariant = variants.concat(masterVariant)
		const variant = allVariant.find((v) => v.key === variantKey);

		if (!variant) {
			throw new Error(`Could not find variant with key "${variantKey}"`);
		}

		return variant
	}

	async checkCartHasChanged(ctCart: Cart): Promise<Cart>{
		const { lineItems } = ctCart;
		if (lineItems.length === 0) return {...ctCart, lineItems: []}

		const mainProductLineItems = lineItems.filter(
			(item: LineItem) => item.custom?.fields?.productType === 'main_product',
		);

		const skus = lineItems.map((item: LineItem) => item.variant.sku);
		const inventoryKey = skus.map((sku: any) => sku).join(',');
		const inventories = await this.ctInventoryClient.getInventory(inventoryKey);

		const { body } = await this.getProductsBySkus(skus);
		const skuItems = body.results;

		const findValidPrice = (variants: any) => {
			return this.findValidPrice({
				prices: variants.prices,
				customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
				date: new Date(),
			});
		}

		const processedItems = lineItems.map((cartItem: any) => {
			const parentQuantity = mainProductLineItems
                .filter((item: LineItem) => item.productId === cartItem.productId)
                .reduce((sum:any, item:any) => sum + item.quantity, 0);

			const matchingSkuItem = skuItems.find(
				(skuItem: any) => cartItem.productId === skuItem.id
			);

			const matchedInventory = inventories.find(
                (invItem: any) => invItem.sku === cartItem.variant.sku
            );

			if (!matchingSkuItem) return cartItem;

			const { quantity } = cartItem;

			const matchedVariant = this.findVariantByKey(
				cartItem?.variant?.key as string,
				matchingSkuItem.masterVariant,
				matchingSkuItem.variants
			);

			const validPrice = findValidPrice(matchedVariant);
            
            let stockAvailable = matchedInventory.stock.available

            // Check maximum stock allocation by journey
            const journey = ctCart.custom?.fields.journey as CART_JOURNEYS
            const journeyConfig = journeyConfigMap[journey];
            if (journeyConfig.inventory) {
                const maximumStockAllocation = matchedInventory.custom.fields[journeyConfig.inventory.maximumKey];
                stockAvailable = maximumStockAllocation;
            }

			const hasChanged = {
				quantity_over_stock: quantity > stockAvailable,
			};

			const updatedItem = {
				...cartItem,
				price: validPrice,
				totalPrice: {
					...validPrice.value,
					centAmount: validPrice.value.centAmount * quantity,
				},
				parentQuantity,
				hasChanged
			}

			return updatedItem;
		}).filter(Boolean);

		// Recalculate total cart values
		const totalPrice = processedItems.reduce(
			(acc: number, product: any) => acc + product.totalPrice.centAmount,
			0
		);
		const totalLineItemQuantity = processedItems.reduce(
			(total: number, item: LineItem) => total + item.quantity,
			0
		);

		return {
			...ctCart,
			lineItems: processedItems ?? [],
			totalPrice: {
				...ctCart.totalPrice,
				centAmount: totalPrice,
			},
			totalLineItemQuantity,
		};
	}

}

export default CommercetoolsProductClient.getInstance();
