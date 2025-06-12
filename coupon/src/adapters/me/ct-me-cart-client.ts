// cart/src/adapters/me/ct-me-cart-client.ts

import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/sdk-client-v2';
import { createAuthMiddlewareWithExistingToken } from '@commercetools/sdk-middleware-auth';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';
import type {
	Cart,
	MyCartUpdate,
	MyCartUpdateAction,
	ApiRoot,
	LineItem,
	CustomLineItem,
} from '@commercetools/platform-sdk';
import type { ICart, IImage, IItem } from '../../interfaces/cart';
import { CART_EXPIRATION_DAYS } from '../../constants/cart.constant';
import dayjs from 'dayjs';
import CommercetoolsProductClient from '../ct-product-client';
import { readConfiguration } from '../../utils/config.utils';
import { HTTP_STATUSES } from '../../constants/http.constant';

export default class CommercetoolsMeCartClient {
	private apiRoot: ApiRoot;
	private projectKey: string;
	private readonly ctProductClient;
	constructor(accessToken: string) {
		this.projectKey = readConfiguration().ctpProjectKey as string;

		const client = new ClientBuilder()
			.withProjectKey(this.projectKey)
			.withMiddleware(
				createAuthMiddlewareWithExistingToken(`Bearer ${accessToken}`)
			)
			.withMiddleware(
				createHttpMiddleware({
					host: readConfiguration().ctpApiUrl,
				})
			)
			.build();

		this.apiRoot = createApiBuilderFromCtpClient(client);
		this.ctProductClient = CommercetoolsProductClient;
	}

	/**
	 * Retrieves the current user's cart by ID with a 7-day expiration check.
	 * @param cartId - The ID of the cart to retrieve.
	 */
	public async getCartById(cartId: string): Promise<Cart | null> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.me()
				.carts()
				.withId({ ID: cartId })
				.get({ queryArgs: { expand: ['custom.fields.couponsInfomation', 'custom.fields.package'] } })
				.execute();

			return response.body;
		} catch (error: any) {
			console.error(`Error fetching cart with ID ${cartId}:`, error);
			return null;
		}
	}

	/**
	 * Updates the current user's cart with the specified actions.
	 * @param cartId - The ID of the cart.
	 * @param version - The current version of the cart.
	 * @param actions - The update actions to perform.
	 */
	public async updateCart(
		cartId: string,
		version: number,
		actions: MyCartUpdateAction[],
	): Promise<Cart> {
		try {
			const cartUpdate: MyCartUpdate = {
				version,
				actions,
			};

			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.me()
				.carts()
				.withId({ ID: cartId })
				.post({ body: cartUpdate })
				.execute();

			return response.body;
		} catch (error: any) {
			console.error('updateCart.error', error);
			throw error;
		}
	}

	findLineItem({
		cart,
		variantId,
		productGroup,
		productType,
		addOnGroup,
	}: {
		cart: Cart;
		variantId: number;
		productGroup: number;
		productType: string;
		addOnGroup: string;
	}) {
		const lineItem = cart.lineItems.find((item) => item.variant.id === variantId &&
			item.custom?.fields?.productType === productType &&
			item.custom?.fields?.productGroup === productGroup &&
			(!addOnGroup || item.custom?.fields?.addOnGroup === addOnGroup));

		return lineItem;
	}

	/**
	 * Finds the line item ID in the cart by variant ID.
	 * @param cart - The current cart object.
	 * @param variantId - The variant ID to search for.
	 */
	private findLineItemId({
		cart,
		variantId,
		productGroup,
		productType,
		addOnGroup
	}: {
		cart: Cart
		variantId: number
		productGroup: number
		productType: string
		addOnGroup: string
	}): string {
		const lineItem = this.findLineItem({
			cart,
			variantId,
			productGroup,
			productType,
			addOnGroup,
		});
		if (!lineItem) {
			throw new Error('Line item not found in cart');
		}
		return lineItem.id;
	}

	private findSecondaryLineItemIdsInProductGroup(cart: Cart, productGroup?: number) {
		const lineItemIds = cart.lineItems.filter((item) =>
			item.custom?.fields?.productType !== 'main_product' &&
			item.custom?.fields?.productGroup === productGroup)
			.map((item) => item.id)

		return lineItemIds
	}

	/**
	 * Helper method to find line item IDs based on variant IDs.
	 * @param cart - The current cart object.
	 * @param variantIds - An array of variant IDs to find.
	 * @returns {string[]} An array of corresponding line item IDs.
	*/
	private findLineItemIds(cart: Cart, lineItemKeys: any[]): string[] {
		const { lineItems } = cart
		const lineItemIds: string[] = [];


		lineItemKeys.forEach((lineItemKey) => {
			const { variantId, productGroup, productType, addOnGroup } = lineItemKey
			const lineItem = lineItems.find((item) => item.variant.id === variantId &&
				item.custom?.fields?.productGroup === productGroup &&
				item.custom?.fields?.productType === productType &&
				(!addOnGroup || item.custom?.fields?.addOnGroup === addOnGroup)
			)

			if (lineItem) {
				lineItemIds.push(lineItem.id);

				if (productType === 'main_product') {
					const secondaryLineItemIds = this.findSecondaryLineItemIdsInProductGroup(cart, productGroup)

					lineItemIds.push(...secondaryLineItemIds);
				}

			} else {
				throw {
					statusCode: HTTP_STATUSES.BAD_REQUEST,
					statusMessage: `Line item with variant ID ${variantId} not found in cart.`
				}
			}
		})

		const uniqueLineItemIds = [...new Set(lineItemIds)];

		return uniqueLineItemIds;
	}

	/**
	 * Updates the quantity of a specific item in the cart.
	 * @param cart - The current cart object.
	 * @param variantId - The variant ID of the item.
	 * @param quantity - The new quantity.
	 */
	public async updateItemQuantityInCart({
		cart,
		variantId,
		productGroup,
		productType,
		addOnGroup,
		quantity,
	}: {
		cart: Cart
		variantId: number
		productGroup: number
		productType: string
		addOnGroup: string
		quantity: number
	}): Promise<Cart> {
		const updateActions: MyCartUpdateAction[] = [];

		if (quantity > 0) {
			updateActions.push({
				action: 'changeLineItemQuantity',
				lineItemId: this.findLineItemId({
					cart,
					variantId,
					productGroup,
					productType,
					addOnGroup
				}),
				quantity,
			});
		} else {
			const lineItemIds = this.findLineItemIds(cart, [{
				variantId,
				productGroup,
				productType,
				addOnGroup
			}])

			const removeLineItemActions = lineItemIds.map((lineItemId) => {
				return {
					action: 'removeLineItem',
					lineItemId
				}
			})
			updateActions.push(...removeLineItemActions as MyCartUpdateAction[]);
		}

		const updatedCart = await this.updateCart(
			cart.id,
			cart.version,
			updateActions
		);

		return updatedCart;
	}

	/**
	 * Removes an item from the current user's cart by variant ID.
	 * @param cart - The current cart object.
	 * @param variantId - The variant ID of the item to remove.
	 */
	public async removeItemFromCart({
		cart,
		variantId,
		productType,
		productGroup,
		addOnGroup
	}: {
		cart: Cart,
		variantId: number,
		productType: string
		productGroup: number,
		addOnGroup: string,
	}): Promise<Cart> {
		const lineItemIds = this.findLineItemIds(cart, [{
			variantId,
			productType,
			productGroup,
			addOnGroup
		}]);

		const updatedCart = await this.removeMultipleItemsFromCart(
			cart.id,
			cart.version,
			lineItemIds,
		);

		return updatedCart;
	}

	/**
 * Removes multiple line items from the current user's cart.
 * @param cartId - The ID of the cart.
 * @param version - The current version of the cart.
 * @param lineItemIds - An array of line item IDs to remove.
 */
	public async removeMultipleItemsFromCart(
		cartId: string,
		version: number,
		lineItemIds: string[],
	): Promise<Cart> {
		const updateActions: MyCartUpdateAction[] = lineItemIds.map((lineItemId: string) => ({
			action: 'removeLineItem',
			lineItemId,
		}));

		const cartUpdate: MyCartUpdate = {
			version,
			actions: updateActions,
		};

		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.me()
			.carts()
			.withId({ ID: cartId })
			.post({ body: cartUpdate })
			.execute();

		return response.body;
	}

	public async removeItemsFromCart(
		cart: Cart,
		lineItemKeys: any[],
	): Promise<Cart> {
		const lineItemIds = this.findLineItemIds(cart, lineItemKeys);

		if (lineItemIds.length === 0) {
			throw new Error('No valid line items found to remove.');
		}

		const updatedCart = await this.removeMultipleItemsFromCart(
			cart.id,
			cart.version,
			lineItemIds,
		);

		return updatedCart;
	}

	/**
	 * Calculates the expiration Date by adding deleteDaysAfterLastModification to lastModifiedAt
	 * and subtracting a buffer time of 5 minutes.
	 *
	 * @param lastModifiedAt - The ISO 8601 string representing the last modification date of the cart.
	 * @param deleteDaysAfterLastModification - Number of days after last modification when the cart expires.
	 * @returns The Date object representing the expiration timestamp with a 5-minute buffer.
	 *
	 * @throws Will throw an error if inputs are invalid.
	 */
	calculateExpiredAt(lastModifiedAt: string, deleteDaysAfterLastModification: number): Date {
		if (!lastModifiedAt || typeof lastModifiedAt !== 'string') {
			throw new Error('Invalid lastModifiedAt value provided.');
		}

		if (
			typeof deleteDaysAfterLastModification !== 'number' || deleteDaysAfterLastModification <= 0
		) {
			throw new Error('Invalid deleteDaysAfterLastModification value provided.');
		}

		const expiredAtDate = dayjs(lastModifiedAt).add(deleteDaysAfterLastModification, 'day');

		if (!expiredAtDate.isValid()) {
			throw new Error('Calculated expiredAt date is invalid.');
		}

		return expiredAtDate.toDate();
	}

	calculateQuantities(items: IItem[]) {
		let totalQuantity = 0;
		const quantitiesByProductType: { [key: string]: number } = {};

		for (const item of items) {
			totalQuantity += item.quantity;

			const productType = item.productType || 'unknown';

			if (quantitiesByProductType[productType]) {
				quantitiesByProductType[productType] += item.quantity;
			} else {
				quantitiesByProductType[productType] = item.quantity;
			}
		}

		return {
			totalQuantity,
			quantitiesByProductType,
		};
	}

	private getVariantImage(lineItem: LineItem): IImage | null {
		if (lineItem.variant.images && lineItem.variant.images.length > 0) {
			return lineItem.variant.images[0];
		}

		return null;
	}

	/**
	 * Calculates the total price of custom line items.
	 * @param customLineItems - Array of custom line items from the cart.
	 * @returns The total price of custom line items.
	 */
	private calculateCustomLineItemsTotalPrice(customLineItems: CustomLineItem[]): number {
		return customLineItems.reduce(
			(total, cli) => total + cli.totalPrice.centAmount,
			0
		);
	}

	/**
	 * Maps the Commercetools Cart to a custom ICart interface.
	 * @param ctCart - The Commercetools Cart object.
	 */
	mapCartToICart(ctCart: Cart): ICart {
		const items: IItem[] = [...ctCart.lineItems]
			.sort((a: LineItem, b: LineItem) => {
				const productGroupA = a.custom?.fields?.productGroup || 0;
				const productGroupB = b.custom?.fields?.productGroup || 0;

				if (productGroupA !== productGroupB) {
					return productGroupA - productGroupB;
				}

				const dateA = new Date(a.addedAt ?? 0).getTime();
				const dateB = new Date(b.addedAt ?? 0).getTime();
				return dateA - dateB;
			})
			.map((lineItem: LineItem) => {
				if (!lineItem.variant.sku) {
					throw new Error(`SKU is undefined for productId: ${lineItem.productId}`);
				}

				const selected = lineItem.custom?.fields?.selected ?? false;
				const productType = lineItem.custom?.fields?.productType;
				const productGroup = lineItem.custom?.fields?.productGroup;
				const addOnGroup = lineItem.custom?.fields?.addOnGroup;
				const image = this.getVariantImage(lineItem);
				const totalUnitPrice = lineItem.price.value.centAmount * lineItem.quantity;
				const discountAmount = this.calculateTotalDiscountAmount(lineItem);
				const priceAfterDiscount = lineItem.totalPrice.centAmount;

				const item: IItem = {
					productId: lineItem.productId,
					productKey: lineItem.productKey,
					productName: lineItem.name,
					ctProductType: lineItem.productType,
					productSlug: lineItem.productSlug,
					variantId: lineItem.variant.id,
					sku: lineItem.variant.sku,
					productType,
					productGroup,
					addOnGroup,
					image,
					quantity: lineItem.quantity,
					unitPrice: lineItem.price.value.centAmount,
					totalUnitPrice,
					discountAmount,
					priceAfterDiscount,
					finalPrice: priceAfterDiscount,
					appliedEffects: [],
					attributes: lineItem.variant.attributes || [],
					selected,
				};

				return item;
			});

		const { totalQuantity, quantitiesByProductType } = this.calculateQuantities(items);

		// Subtotal price: sum of unit prices times quantities before discounts
		const subtotalPrice = items.reduce(
			(total, item) => total + item.unitPrice * item.quantity,
			0
		);

		// Total price after discounts for line items
		const lineItemsTotalPrice = items.reduce(
			(total, item) => total + item.priceAfterDiscount,
			0
		);

		// Process customLineItems (e.g., cart-level discounts)
		const customLineItems = ctCart.customLineItems || [];

		// Use the new function to calculate the total price of custom line items
		const customLineItemsTotalPrice = this.calculateCustomLineItemsTotalPrice(customLineItems);

		// Total price after discount (line items + custom line items)
		const totalPriceAfterDiscount = lineItemsTotalPrice + customLineItemsTotalPrice;

		// Shipping cost
		const shippingCost = ctCart.shippingInfo?.price?.centAmount || 0;

		// Grand total: totalPriceAfterDiscount plus shipping cost
		const grandTotal = totalPriceAfterDiscount + shippingCost;

		// Calculate total discount: subtotalPrice minus totalPriceAfterDiscount
		const totalDiscount = subtotalPrice - totalPriceAfterDiscount;

		// Calculate expiredAt using lastModifiedAt and deleteDaysAfterLastModification
		const lastModifiedAt = ctCart.lastModifiedAt;
		const deleteDaysAfterLastModification =
			ctCart.deleteDaysAfterLastModification || CART_EXPIRATION_DAYS;
		const expiredAt = this.calculateExpiredAt(
			lastModifiedAt,
			deleteDaysAfterLastModification,
		);

		const iCart: ICart = {
			cartId: ctCart.id,
			locale: ctCart?.locale || null,
			campaignGroup: ctCart.custom?.fields.campaignGroup,
			journey: ctCart.custom?.fields.journey,
			subtotalPrice,
			totalDiscount,
			totalPriceAfterDiscount,
			shippingCost,
			grandTotal,
			currencyCode: ctCart.totalPrice.currencyCode,
			totalQuantity,
			shippingMethod: ctCart.shippingInfo?.shippingMethod || null,
			paymentMethod: ctCart.custom?.fields?.paymentMethod || null,
			shippingAddress: ctCart.shippingAddress || null,
			billingAddress: ctCart.billingAddress || null,
			quantitiesByProductType,
			items,
			triggeredCampaigns: [],
			appliedEffects: [],
			createdAt: new Date(ctCart.createdAt),
			updatedAt: new Date(ctCart.lastModifiedAt),
			deleteDaysAfterLastModification: ctCart.deleteDaysAfterLastModification || 30,
			expiredAt,
		};

		return iCart;
	}

	mapInventoryToItems(items: IItem[], inventoryMap: Map<string, any>): void {
		items.forEach((item) => {
			const sku = item.sku;
			const inventory = inventoryMap.get(sku);
			if (inventory) {
				const { id, key, stock, isOutOfStock } = inventory;
				item.inventory = { id, key, stock, isOutOfStock };
			} else {
				item.inventory = null;
			}
		});
	}

	calculateTotalDiscountAmount(lineItem: any) {
		return lineItem.discountedPricePerQuantity.reduce((totalDiscount: any, quantity: any) => {
			const unitDiscount = quantity.discountedPrice.includedDiscounts.reduce(
				(sum: any, discount: any) => sum + discount.discountedAmount.centAmount,
				0
			);
			return totalDiscount + unitDiscount * quantity.quantity;
		}, 0);
	}

	async resetCartItemProductGroup(ctCart: Cart) {
		const { id, version, lineItems } = ctCart
		const productGroupMapLineItemIds = lineItems?.reduce((acc: any, lineItem: any) => {
			const productGroup = lineItem.custom.fields.productGroup
			if (!acc?.[productGroup]) {
				acc[productGroup] = []
			}

			acc[productGroup].push(lineItem.id)

			return acc
		}, {})

		const actions: MyCartUpdateAction[] = [];
		Object.keys(productGroupMapLineItemIds)
			.sort((a: any, b: any) => a - b)
			.forEach((currentProductGroup, index) => {
				const expectedSequence = index + 1
				if (+currentProductGroup === expectedSequence) {
					return
				}
				const lineItemIds = productGroupMapLineItemIds[currentProductGroup]

				const updateProductGroupActions = lineItemIds.map((lineItemId: string) => ({
					action: 'setLineItemCustomField',
					lineItemId: lineItemId,
					name: 'productGroup',
					value: expectedSequence
				}))
				actions.push(...updateProductGroupActions)
			})
		if (!actions.length) {
			return ctCart
		}

		const update: MyCartUpdate = {
			version: version,
			actions: actions,
		};

		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.me()
			.carts()
			.withId({ ID: id })
			.post({ body: update })
			.execute();

		return response.body;
	}

	async validateInsurance(ctCart: any, insurance: any) {
		const {
			productGroup,
			productId,
			sku
		} = insurance

		const { lineItems } = ctCart;

		const mainProduct = lineItems.find((lineItem: any) => {
			return lineItem.custom?.fields?.productType === 'main_product' &&
				lineItem.custom?.fields?.productGroup === productGroup
		})

		if (!mainProduct) {
			return {
				isValid: false,
				errorMessage: 'A main product is required for the specified insurance product.'
			}
		}

		const insuranceReferenceIds = mainProduct
			.variant
			.attributes
			.filter((attribute: any) => attribute.name === 'insurance_reference')
			.flatMap((attribute: any) => attribute.value.map((subItem: any) => subItem.id));

		if (!insuranceReferenceIds?.length) {
			return {
				isValid: false,
				errorMessage: 'The main product does not contain any insurance products.'
			};
		}

		const result = await this.ctProductClient.getProductsByIds(insuranceReferenceIds);
		const insuranceProducts = result?.body?.results;
		const insuranceProduct = insuranceProducts.find((insuranceProduct: any) => insuranceProduct.id === productId)

		if (!insuranceProduct) {
			return {
				isValid: false,
				errorMessage: 'The insurance product was not found.'
			};
		}

		const { masterVariant, variants } = insuranceProduct
		const allVariants = [masterVariant, ...variants]

		const matchedVariant = allVariants?.find((variant: any) => variant.sku === sku)

		if (!matchedVariant) {
			return {
				isValid: false,
				errorMessage: 'The SKU for the insurance product was not found.'
			};
		}
		return {
			isValid: true,
			errorMessage: ''
		};
	}

	async attachInsuranceToICart(iCart: any) {
		const { items } = iCart
		const allInsuranceReferenceIds = items
			.filter((item: any) => item.productType === 'main_product')
			.flatMap((item: any) => item.attributes)
			.filter((attribute: any) => attribute.name === 'insurance_reference')
			.flatMap((attribute: any) => attribute.value.map((subItem: any) => subItem.id));

		const insuranceItems = items.filter((item: any) => item.productType === 'insurance')
		const selectedInsuranceMap = insuranceItems.reduce((acc: any, insuranceItem: any) => {
			const { productGroup, productId, sku, quantity } = insuranceItem
			acc[productGroup] = acc[productGroup] || {}
			acc[productGroup][productId] = acc[productGroup][productId] || {}
			acc[productGroup][productId][sku] = acc[productGroup][productId][sku] + quantity || quantity

			return acc;
		}, {})

		let insuranceReferenceMap: any = {}
		if (allInsuranceReferenceIds?.length) {
			const result = await this.ctProductClient.getProductsByIds(allInsuranceReferenceIds);
			const insuranceProducts = result?.body?.results;
			insuranceReferenceMap = insuranceProducts.reduce((acc: any, current) => {
				acc[current.id] = current
				return acc
			}, insuranceReferenceMap)
		}

		const withInsuranceItems = items.map((item: any) => {
			const { productGroup } = item
			const insuranceReferenceIds = item
				?.attributes
				?.filter((attribute: any) => attribute.name === 'insurance_reference')
				?.flatMap((attribute: any) => attribute.value.map((subItem: any) => subItem.id)) || [];

			const insurances = insuranceReferenceIds
				.filter((insuranceReferenceId: any) => insuranceReferenceMap?.[insuranceReferenceId])
				.map((insuranceReferenceId: any) => {
					const insuranceReference = insuranceReferenceMap?.[insuranceReferenceId]
					const { masterVariant, variants, ...insuranceReferenceInfo } = insuranceReference
					const allVariants = [masterVariant, ...variants];
					const newVariants = allVariants.map((variant: any) => {
						const { sku } = variant
						return {
							...variant,
							totalSelectedItem: selectedInsuranceMap?.[productGroup]?.[insuranceReferenceInfo.id]?.[sku] || 0
						}
					});
					return {
						...insuranceReferenceInfo,
						variants: newVariants
					}
				})
			return {
				...item,
				insurances
			}
		})

		return {
			...iCart,
			items: withInsuranceItems
		};
	}

	filterSelectedLineItems(lineItems: LineItem[], selectedOnly: boolean): LineItem[] {
		if (!selectedOnly) {
			return lineItems;
		}

		// Otherwise, only return those marked “selected”
		return lineItems.filter((lineItem: LineItem) => {
			return lineItem.custom?.fields?.selected === true;
		});
	}
}
