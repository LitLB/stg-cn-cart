import { LineItem } from '@commercetools/platform-sdk';
// src/server/adapters/ct-product-client.ts

import type { ApiRoot, Cart, Price, Product, ProductDraft, ProductPagedQueryResponse, ProductVariant } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from '../adapters/ct-base-client';
import { CT_PRODUCT_ACTIONS } from '../constants/ct.constant';
import { readConfiguration } from '../utils/config.utils';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import { CustomLineItemVariantAttribute, HasChangedAction } from '../types/custom.types';
import { IAdapter } from '../interfaces/adapter.interface';
import _ from 'lodash';
import { CommercetoolsStandalonePricesClient } from './ct-standalone-prices-client';
import { HTTP_STATUSES } from '../constants/http.constant';

export class CommercetoolsProductClient implements IAdapter {
	public readonly name = 'commercetoolsProductClient' as const
	private static instance: CommercetoolsProductClient;
	private apiRoot: ApiRoot;
	private projectKey: string;
	private readonly ctInventoryClient;
	private readonly ctStandalonePriceClient;


	constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
		this.ctInventoryClient = CommercetoolsInventoryClient;
		this.ctStandalonePriceClient = CommercetoolsStandalonePricesClient.getInstance();
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

	async getProductById(id: string, queryParams?: any): Promise<Product> {
		const product = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.products()
			.withId({ ID: id })
			.get({ queryArgs: queryParams })
			.execute();
		return product.body;
	}

	async queryProducts(queryParams: any): Promise<ProductPagedQueryResponse> {
		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.products()
			.get({ queryArgs: queryParams })
			.execute();
		return response.body;
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
	
	findProductJourney(product: Product): { key: string; label: string }[] {
		const { masterVariant } = product.masterData.current;
		const journey = masterVariant?.attributes?.find((v) => v.name === 'journey');
		return journey?.value || []
	}

	async getProductsBySkus(skus: any[], expand?:string[]): Promise<any> {
		const skusFilter = `variants.sku: ${skus.map(sku => `"${sku}"`).join(',')}`
		const products = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.productProjections()
			.search()
			.get({
				queryArgs: {
					filter: skusFilter,
					expand,
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

	async checkCartHasChanged(ctCart: Cart): Promise<Cart> {
		let  { lineItems } = ctCart;

		//Only `main_product`
		lineItems = lineItems.filter((lineItem) => lineItem.custom?.fields?.productType !== 'bundle' && lineItem.custom?.fields?.productType !== 'sim')
		
		if (lineItems.length === 0) return { ...ctCart, lineItems: [] }

		const mainProductLineItems = lineItems.filter(
			(item: LineItem) => item.custom?.fields?.productType === 'main_product',
		);

		const skus = lineItems.map((item: LineItem) => item.variant.sku);
		const inventoryKey = skus.map((sku: any) => sku).join(',');
		const inventories = await this.ctInventoryClient.getInventory(inventoryKey);

		const { body } = await this.getProductsBySkus(skus);
		const skuItems = body.results;

		const findValidPrice = async (variants: ProductVariant): Promise<Price> => {
			try {

				if (!variants.sku) {
					throw {
						statusCode: HTTP_STATUSES.NOT_FOUND,
						statusMessage: 'No SKU found for the specified variant',
					};

				}
				const standalonePrice = await this.ctStandalonePriceClient.getStandalonePricesBySku(variants.sku);

				if (!standalonePrice?.length) {
					throw {
						statusCode: HTTP_STATUSES.NOT_FOUND,
						statusMessage: 'No standalone price found for the specified SKU',
					};
				}


				const validPrice = this.findValidPrice({
					prices: standalonePrice,
					customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
					date: new Date(),
				});

				if (!validPrice) {
					throw {
						statusCode: HTTP_STATUSES.NOT_FOUND,
						statusMessage: 'No valid price found for the specified criteria',
					};
				}

				return validPrice;
			} catch (error) {
				console.error('Error finding valid price:', error);
				throw error;
			}
		}


		const processedItems = await Promise.all(lineItems.map(async (cartItem: LineItem) => {

			const parentQuantity = mainProductLineItems
				.filter((item: LineItem) => item.productId === cartItem.productId)
				.reduce((sum: any, item: any) => sum + item.quantity, 0);

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


			const validPrice = await findValidPrice(matchedVariant).catch((error) => {
				console.error('Error finding valid price:', error);
				throw {
					statusCode: HTTP_STATUSES.NOT_FOUND,
					statusMessage: 'No valid price found for the specified criteria',
				};
			});

			console.log('validPrice', validPrice)

			let stockAvailable: number = matchedInventory.stock.available

			const hasChangedAction: HasChangedAction = { action: 'NONE', updateValue: 0 }
			let quantityOverStock = quantity > stockAvailable

            // Check maximum stock allocation by journey
            const cartJourney = ctCart.custom?.fields.journey as CART_JOURNEYS
            const isPreOrder = ctCart.custom?.fields.preOrder as boolean || false
            const productJourney = (cartItem.variant.attributes?.find((attr: CustomLineItemVariantAttribute) => attr.name === 'journey')?.value[0]?.key || CART_JOURNEYS.SINGLE_PRODUCT) as CART_JOURNEYS
            const lineItemJourney = cartJourney === CART_JOURNEYS.SINGLE_PRODUCT && cartJourney !== productJourney ? productJourney : cartJourney
            const journeyConfig = journeyConfigMap[lineItemJourney]
            
            let maximumStockAllocation: number | undefined
            if (journeyConfig.inventory) {
                // !!exclude dummy stock
                // NOTE - stock physical when dummy stock is 0, null, undefined, blank text.
                const dummyStock: number = matchedInventory.custom.fields[journeyConfig.inventory.dummyKey] || 0
                const isDummyStock: boolean = isPreOrder && dummyStock > 0    
                if (!isDummyStock) {
                    maximumStockAllocation = matchedInventory.custom.fields[journeyConfig.inventory.maximumKey];
                    const totalPurchase: number = matchedInventory.custom.fields[journeyConfig.inventory.totalKey] || 0
                    // use min value of stock
                    if (maximumStockAllocation !== undefined && maximumStockAllocation > 0) {
                        const maximumStockAllocationAvailable = maximumStockAllocation - totalPurchase
                        stockAvailable = Math.min(maximumStockAllocationAvailable, stockAvailable)
                    }

                    if (stockAvailable <= 0) {
                        hasChangedAction.action = 'REMOVE_LINE_ITEM'
                        quantityOverStock = true
                    } else if ((maximumStockAllocation !== undefined && maximumStockAllocation !== 0) && quantity > stockAvailable) {
                        // update quantity if stock allocation less than quantity
                        hasChangedAction.action = 'UPDATE_QUANTITY'
                        hasChangedAction.updateValue = stockAvailable
                        quantityOverStock = true
                    } else if (maximumStockAllocation !== undefined) {
                        // remove if maximumStockAllocation is set to 0 or totalPurchase is less than or equal to maximumStockAllocation
                        if (maximumStockAllocation === 0) {
                            hasChangedAction.action = 'REMOVE_LINE_ITEM'
                            quantityOverStock = true
                        } else if ((totalPurchase >= maximumStockAllocation)) {
                            hasChangedAction.action = 'REMOVE_LINE_ITEM'
                            quantityOverStock = true
                        }
                    } else if ((maximumStockAllocation === undefined || maximumStockAllocation === 0 ) && quantity > stockAvailable) {
                        hasChangedAction.action = 'UPDATE_QUANTITY'
                        hasChangedAction.updateValue = stockAvailable
                        quantityOverStock = true
                    }
                }
            }

			const hasChanged = {
				quantity_over_stock: quantityOverStock,
			};

			const updatedItem = {
				...cartItem,
				price: validPrice,
				totalPrice: {
					...validPrice.value,
					centAmount: validPrice.value.centAmount * quantity,
				},
				parentQuantity,
				hasChanged,
				hasChangedAction,
			}

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
			lineItems: lineItems.filter((lineItem) => !lineItem.custom?.fields?.productType).concat(processedItems as LineItem[]) ?? [],
			totalPrice: {
				...ctCart.totalPrice,
				centAmount: totalPrice,
			},
			totalLineItemQuantity,
		};
	}

	getProductCategoryName(categories: any[]) {
		const parentCategoryName = categories?.[0]?.obj?.parent?.obj?.name || null
		const categoryName = categories?.[0]?.obj?.name || null

		return parentCategoryName ? parentCategoryName : categoryName
	}
}

export default CommercetoolsProductClient.getInstance();
