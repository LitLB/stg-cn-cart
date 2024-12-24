import { LineItem } from '@commercetools/platform-sdk';
// src/server/adapters/ct-product-client.ts

import type { ApiRoot, Product, ProductDraft, ProductVariant } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from '../adapters/ct-base-client';
import { CT_PRODUCT_ACTIONS } from '../constants/ct.constant';
import { readConfiguration } from '../utils/config.utils';
import { getAttributeValue } from '../utils/product-utils';
import CommercetoolsMeCartClient from './me/ct-me-cart-client';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client'

class CommercetoolsProductClient {
	private static instance: CommercetoolsProductClient;
	private apiRoot: ApiRoot;
	private projectKey: string;
	private readonly ctInventoryClient;
	private onlineChannel: string;


	private constructor() {
		this.onlineChannel = readConfiguration().onlineChannel as string;
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

	async checkCartHasChanged(ctCart: any) {
		const { lineItems,totalLineItemQuantity:oldCartQuantity } = ctCart;
	
		const skus = lineItems.map((item: any) => item.variant.sku);

		const inventoryKey = skus.map((sku: any) => sku).join(',');

		const inventories = await this.ctInventoryClient.getInventory(inventoryKey);
		

		console.log(`this.onlineChannel : ${this.onlineChannel}`)

		// TODO :: CHECK AVAILABLE

		const inventoryMap = new Map<string, any>();
		inventories.forEach((inventory: any) => {
			const key = inventory.key;
			const sku = key.replace(`${this.onlineChannel}-`, '');
			inventoryMap.set(sku, inventory);
		});


		const { body } = await this.getProductsBySkus(skus);
		const skuItems = body.results;
	
		// Helper function to find valid price
		const findValidPrice = (variants: any) => {
			return this.findValidPrice({
				prices: variants.prices,
				customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
				date: new Date(),
			});
		}

		// Filter main products
		const mainProducts = lineItems.filter(
			(item: any) => item.custom?.fields?.productType === "main_product"
		);
	
		// Process cart items to check for changes
		const processedItems = mainProducts.map((cartItem: any) => {

			const matchingSkuItem = skuItems.find(
				(skuItem: any) => cartItem.productId === skuItem.id
			);

			if (!matchingSkuItem) return cartItem;
			const { quantity, price } = cartItem;

			// Find matched variant
			const matchedVariant = this.findVariantByKey(
				cartItem?.variant?.key,
				matchingSkuItem.masterVariant,
				matchingSkuItem.variants
			);


			const validPrice = findValidPrice(matchedVariant);
			const skuAttributes = matchedVariant?.attributes ?? [];
			// Determine if attributes or price have changed

			const parentMax = getAttributeValue(skuAttributes, "quantity_max");
			const parentMin = getAttributeValue(skuAttributes, "quantity_min");
			const skuMax = getAttributeValue(skuAttributes, "sku_quantity_max");
			const skuMin = getAttributeValue(skuAttributes, "sku_quantity_min");

			const hasChanged = {
				price: validPrice.value.centAmount !== price.value.centAmount,
				quantityOverParentMax: parentMax !== null && oldCartQuantity.main_product > parentMax,
				quantityLowerParentMin: parentMax !== null && oldCartQuantity.main_product < parentMin,
				quantityOverSkuMax: skuMax !== null && quantity > skuMax,
				quantityLowerSkuMin: skuMin !== null && quantity < skuMin
			};
	
			// Update item data
			const updatedItem = {
				...cartItem,
				name: matchingSkuItem.name,
				variant: matchedVariant,
				price: validPrice,
				totalPrice: {
					...validPrice.value,
					centAmount: validPrice.value.centAmount * quantity,
				},
				availability: matchedVariant?.availability,
				hasChanged,
			};
	
			return updatedItem;
		}).filter(Boolean); 
	
		// Recalculate total cart values
		const totalPrice = processedItems.reduce(
			(acc: number, product: any) => acc + product.totalPrice.centAmount,
			0
		);
		const totalLineItemQuantity = processedItems.reduce(
			(total: number, item: any) => total + item.quantity,
			0
		);
	
		return {
			...ctCart,
			lineItems: processedItems,
			totalPrice: {
				...ctCart.totalPrice,
				centAmount: totalPrice,
			},
			totalLineItemQuantity,
		};
	}
	
	
}

export default CommercetoolsProductClient.getInstance();
