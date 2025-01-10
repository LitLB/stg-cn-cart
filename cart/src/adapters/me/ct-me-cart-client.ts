// cart/src/adapters/me/ct-me-cart-client.ts

import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/sdk-client-v2';
import { createAuthMiddlewareWithExistingToken } from '@commercetools/sdk-middleware-auth';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';
import { getAttributeValue } from '../../utils/product-utils';
import type {
	Cart,
	MyCartDraft,
	MyCartUpdate,
	MyCartUpdateAction,
	MyLineItemDraft,
	ApiRoot,
	LineItem,
	CustomLineItem,
	CartAddCustomLineItemAction,
	CartAddLineItemAction,
	CartChangeCustomLineItemMoneyAction,
	CartRemoveCustomLineItemAction,
	CartUpdateAction,
	CartChangeCustomLineItemQuantityAction,
} from '@commercetools/platform-sdk';
import type { IAvailableBenefitProduct, IAvailableBenefitProductVariant, ICart, IImage, IItem } from '../../interfaces/cart';
import { CART_EXPIRATION_DAYS, CART_INVENTORY_MODES } from '../../constants/cart.constant';
import dayjs from 'dayjs';
import CommercetoolsInventoryClient from '../ct-inventory-client';
import CommercetoolsCartClient from '../ct-cart-client';
import CommercetoolsProductClient from '../ct-product-client';
import { talonOneEffectConverter } from '../talon-one-effect-converter'
import { readConfiguration } from '../../utils/config.utils';
import { CURRENCY_CODES } from '../../constants/currency.constant';
import { COUNTRIES } from '../../constants/country.constant';
import { HTTP_STATUSES } from '../../constants/http.constant';
import { LOCALES } from '../../constants/locale.constant';
import { updatedCartWithFreeGiftAdded } from '../../mocks/free-gift/updatedCart.mock';
import { lineItemWithCampaignBenefitsMock } from '../../mocks/lineItemWithCampaignBenefits.mock';
import { updateCartFlag } from '../../utils/cart.utils';

export default class CommercetoolsMeCartClient {
	private apiRoot: ApiRoot;
	private projectKey: string;
	private onlineChannel: string;
	private readonly ctCartClient;
	private readonly ctInventoryClient;
	private readonly ctProductClient;
	private readonly talonOneEffectConverter;
	private readonly ctpAddCustomOtherPaymentLineItemPrefix;
	private readonly ctpTaxCategoryId: string;
	constructor(accessToken: string) {
		this.projectKey = readConfiguration().ctpProjectKey as string;
		this.onlineChannel = readConfiguration().onlineChannel as string;
		this.ctpAddCustomOtherPaymentLineItemPrefix = readConfiguration().ctpAddCustomOtherPaymentLineItemPrefix as string;
		this.ctpTaxCategoryId = readConfiguration().ctpTaxCategoryId;
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
		this.ctCartClient = CommercetoolsCartClient;
		this.talonOneEffectConverter = talonOneEffectConverter;
		this.ctInventoryClient = CommercetoolsInventoryClient;
		this.ctProductClient = CommercetoolsProductClient;
	}

	/**
	 * Creates a new cart for the current user with custom fields.
	 * @param campaignGroup - The campaign group for the cart.
	 * @param journey - The journey for the cart.
	 */
	public async createCart(campaignGroup: string, journey: string, locale = LOCALES.TH_TH): Promise<Cart> {
		const cartDraft: MyCartDraft = {
			country: COUNTRIES.TH,
			currency: CURRENCY_CODES.THB,
			// inventoryMode: CART_INVENTORY_MODES.RESERVE_ON_ORDER,
			deleteDaysAfterLastModification: CART_EXPIRATION_DAYS,
			locale,
			custom: {
				type: {
					typeId: 'type',
					key: 'cartOrderCustomType',
				},
				fields: {
					campaignGroup,
					journey,
					preOrder: false
				},
			},
		};

		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.me()
			.carts()
			.post({ body: cartDraft })
			.execute();

		return response.body;
	}

	/**
  * Retrieves the active cart for the current user.
  */
	public async getActiveCart(): Promise<Cart | null> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.me()
				.activeCart()
				.get()
				.execute();

			return response.body;
		} catch (error: any) {
			console.error('Error fetching active cart:', error);
			return null;
		}
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
				.get()
				.execute();

			return response.body;
		} catch (error: any) {
			console.error(`Error fetching cart with ID ${cartId}:`, error);
			return null;
		}
	}

	async updateLineItemSelection(
		cartId: string,
		version: number,
		lineItemId: string,
		selected: boolean,
	): Promise<Cart> {
		const actions: MyCartUpdateAction[] = [
			{
				action: 'setLineItemCustomField',
				lineItemId: lineItemId,
				name: 'selected',
				value: selected,
			},
		];

		const update: MyCartUpdate = {
			version: version,
			actions: actions,
		};

		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.me()
			.carts()
			.withId({ ID: cartId })
			.post({ body: update })
			.execute();

		return response.body;
	}

	/**
	 * Adds a line item to the current user's cart.
	 * @param cartId - The ID of the cart.
	 * @param version - The current version of the cart.
	 * @param lineItemDraft - The draft of the line item to add.
	 */
	public async addLineItemToCart(
		cartId: string,
		version: number,
		lineItemDraft: MyLineItemDraft,
	): Promise<Cart> {
		const updateActions: MyCartUpdateAction[] = [
			{
				action: 'addLineItem',
				...lineItemDraft,
			},
		];

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

	public async updateLineItemSelected(
		cartId: string,
		version: number,
		lineItem: LineItem,
		selected: boolean,
	): Promise<Cart> {
		const updateActions: MyCartUpdateAction[] = [
			{
				action: 'setLineItemCustomType',
				lineItemId: lineItem.id,
				type: {
					typeId: 'type',
					key: 'lineItemCustomType',
				},
				fields: {
					selected: selected,
				},
			},
		];

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

	findLineItem({
		cart,
		variantId,
		productGroup,
		productType,
		addOnGroup,
		freeGiftGroup,
	}: {
		cart: Cart;
		variantId: number;
		productGroup: number;
		productType: string;
		addOnGroup: string;
		freeGiftGroup: string;
	}) {
		const lineItem = cart.lineItems.find((item) => {
			return item.variant.id === variantId &&
				item.custom?.fields?.productType === productType &&
				item.custom?.fields?.productGroup === productGroup &&
				(!addOnGroup || item.custom?.fields?.addOnGroup === addOnGroup) &&
				(!freeGiftGroup || item.custom?.fields?.freeGiftGroup === freeGiftGroup);
		});

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
		addOnGroup,
		freeGiftGroup,
	}: {
		cart: Cart
		variantId: number
		productGroup: number
		productType: string
		addOnGroup: string
		freeGiftGroup: string
	}): string {
		const lineItem = this.findLineItem({
			cart,
			variantId,
			productGroup,
			productType,
			addOnGroup,
			freeGiftGroup,
		});
		if (!lineItem) {
			throw new Error('Line item not found in cart');
		}
		return lineItem.id;
	}

	private findSecondaryLineItemIdsInProductGroup(cart: Cart, productGroup?: number) {
		const lineItemIds = cart.lineItems.filter((item) =>
			item.custom?.fields?.productType !== 'main_product' &&
			item.custom?.fields?.productGroup === productGroup
		)
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
			const { variantId, productGroup, productType, addOnGroup, freeGiftGroup } = lineItemKey
			const lineItem = lineItems.find((item) => {
				return item.variant.id === variantId &&
					item.custom?.fields?.productGroup === productGroup &&
					item.custom?.fields?.productType === productType &&
					(!addOnGroup || item.custom?.fields?.addOnGroup === addOnGroup) &&
					(!freeGiftGroup || item.custom?.fields?.freeGiftGroup === freeGiftGroup);
			})

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
		freeGiftGroup,
		quantity,
	}: {
		cart: Cart
		variantId: number
		productGroup: number
		productType: string
		addOnGroup: string
		freeGiftGroup: string
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
					addOnGroup,
					freeGiftGroup
				}),
				quantity,
			});
		} else {
			const lineItemIds = this.findLineItemIds(cart, [{
				variantId,
				productGroup,
				productType,
				addOnGroup,
				freeGiftGroup
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
		addOnGroup,
		freeGiftGroup,
	}: {
		cart: Cart,
		variantId: number,
		productType: string
		productGroup: number,
		addOnGroup: string,
		freeGiftGroup: string
	}): Promise<Cart> {
		const lineItemIds = this.findLineItemIds(cart, [{
			variantId,
			productType,
			productGroup,
			addOnGroup,
			freeGiftGroup
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

	private getVariantImage(lineItem: LineItem): IImage | null {
		if (lineItem.variant.images && lineItem.variant.images.length > 0) {
			return lineItem.variant.images[0];
		}

		return null;
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
				const freeGiftGroup = lineItem.custom?.fields?.freeGiftGroup
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
					freeGiftGroup,
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
			preOrder: ctCart.custom?.fields.preOrder || false,
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
                // check out of stock allocation
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

	async upsertPrivilegeToCtCart(updatedCart: any, lineItemWithCampaignBenefits: any) {
		const { id: cartId, version, lineItems, customLineItems, totalPrice } = updatedCart;
		const currencyCode = totalPrice.currencyCode
		const myCartUpdateActions: MyCartUpdateAction[] = [];
		const cartUpdateActions: CartUpdateAction[] = []
		const newDirectDiscounts: any[] = [];
	
		lineItems.forEach((lineItem: any) => {
			const lineItemId = lineItem.id
			const lineItemProductType = lineItem.custom.fields.productType
			const lineItemProductGroup = lineItem.custom.fields.productGroup
			const lineItemAddOnGroup = lineItem.custom.fields.addOnGroup
			const lineItemFreeGiftGroup = lineItem.custom.fields.freeGiftGroup
	
			const quantity = lineItem.quantity

			const lineItemWithCampaignBenefit = lineItemWithCampaignBenefits.find((item: any) => {
				return lineItem.variant.sku === item.variant.sku &&
					lineItemProductType === item.custom.fields.productType &&
					lineItemProductGroup === item.custom.fields.productGroup &&
					(!lineItemAddOnGroup || lineItemAddOnGroup === item.custom.fields.addOnGroup) && 
					(!lineItemFreeGiftGroup || lineItemFreeGiftGroup === item.custom.fields.freeGiftGroup)
			})
	
			const newPrivilege = lineItemWithCampaignBenefit?.privilege

			myCartUpdateActions.push({
				action: 'setLineItemCustomField',
				lineItemId,
				name: 'privilege',
				value: newPrivilege ? JSON.stringify(newPrivilege) : '',
			});
	
			const newLineItemDiscounts: any[] = (lineItemWithCampaignBenefit.discounts ?? [])
			const discounts = []
			if (newLineItemDiscounts.length) {
				// ! Main product
				// ! Add on
				// ! Free gift
	
				for (const newLineItemDiscount of newLineItemDiscounts) {
					const { benefitType } = newLineItemDiscount
					if (benefitType === 'main_product') {
						const { discountBaht } = newLineItemDiscount
						const predicate = [
							`product.id ="${lineItem.productId}"`,
							`custom.productType = "${lineItemProductType}"`,
							`custom.productGroup = ${lineItemProductGroup}`
						].join(' AND ');
	
						newDirectDiscounts.push({
							target: {
								type: 'lineItems',
								predicate,
							},
							value: {
								type: 'absolute',
								money: [
									{
										currencyCode: 'THB',
										centAmount: quantity * discountBaht,
									},
								],
							},
						})
					}
	
					if (benefitType === 'add_on') {
						const { specialPrice } = newLineItemDiscount
						const predicate = [
							`product.id ="${lineItem.productId}"`,
							`custom.productType = "${lineItemProductType}"`,
							`custom.productGroup = ${lineItemProductGroup}`,
							`custom.addOnGroup = "${lineItemAddOnGroup}"`,
						].join(' AND ');
	
						newDirectDiscounts.push({
							target: {
								type: 'lineItems',
								predicate,
							},
							value: {
								type: 'fixed',
								money: [
									{
										currencyCode: 'THB',
										centAmount: specialPrice,
									},
								],
							},
						})
					}

					if (benefitType === 'free_gift') {
						const lineItemPrice = lineItem.price?.value?.centAmount || 0;
						const totalLineCost = lineItemPrice * quantity;
	
						const predicate = [
							`product.id = "${lineItem.productId}"`,
							`custom.productType = "${lineItemProductType}"`,
							`custom.productGroup = ${lineItemProductGroup}`,
							`custom.freeGiftGroup = "${lineItemFreeGiftGroup}"`,
						].join(' AND ');
	
						newDirectDiscounts.push({
							target: {
								type: 'lineItems',
								predicate,
							},
							value: {
								type: 'absolute',
								money: [
									{
										currencyCode: 'THB',
										centAmount: totalLineCost,
									},
								],
							},
						});
					}
	
					discounts.push(JSON.stringify(newLineItemDiscount))
				}
			}
	
			myCartUpdateActions.push({
				action: 'setLineItemCustomField',
				lineItemId,
				name: 'discounts',
				value: discounts,
			});

			const newLineItemOtherPayments: any[] = (lineItemWithCampaignBenefit.otherPayments ?? [])
			const otherPayments = []
	
	
			const otherPaymentCustomLineItems = customLineItems.filter(
				(item: any) => item.slug.startsWith(`${lineItemId}-${this.ctpAddCustomOtherPaymentLineItemPrefix}`)
			)
	
			let deleteOtherPaymentCustomLineItems = otherPaymentCustomLineItems
			if (newLineItemOtherPayments.length) {
				for (const newLineItemOtherPayment of newLineItemOtherPayments) {
					otherPayments.push(JSON.stringify(newLineItemOtherPayment))
					const { otherPaymentCode, otherPaymentAmt } = newLineItemOtherPayment
					const slug = `${lineItemId}-${this.ctpAddCustomOtherPaymentLineItemPrefix}-${otherPaymentCode}`
					const existingOtherPaymentCustomLineItem = otherPaymentCustomLineItems.find((item: any) => item.slug.startsWith(slug))
	
					if (existingOtherPaymentCustomLineItem) {
						const existingOtherPaymentAmount = existingOtherPaymentCustomLineItem.money.centAmount;
	
						if (existingOtherPaymentAmount !== otherPaymentAmt) {
							const changeCustomLineItemMoney: CartChangeCustomLineItemMoneyAction = {
								action: 'changeCustomLineItemMoney',
								customLineItemId: existingOtherPaymentCustomLineItem.id,
								money: {
									centAmount: -1 * otherPaymentAmt,
									currencyCode,
								},
							};
	
							const changeCustomLineItemQuantity: CartChangeCustomLineItemQuantityAction = {
								action: 'changeCustomLineItemQuantity',
								customLineItemId: existingOtherPaymentCustomLineItem.id,
								quantity
							};
							cartUpdateActions.push(...[
								changeCustomLineItemMoney,
								changeCustomLineItemQuantity
							]);
						}
					} else {
						const customLineItem: CartAddCustomLineItemAction = {
							action: 'addCustomLineItem',
							name: { en: slug },
							money: {
								centAmount: -1 * otherPaymentAmt,
								currencyCode,
							},
							quantity,
							slug,
							taxCategory: {
								typeId: 'tax-category',
								id: this.ctpTaxCategoryId,
							},
						};
						cartUpdateActions.push(customLineItem);
					}
	
					deleteOtherPaymentCustomLineItems = deleteOtherPaymentCustomLineItems.filter((item: any) => !item.slug.startsWith(slug))
				}
			}
	
			if (deleteOtherPaymentCustomLineItems.length) {
				const removeCustomLineItemActions: CartRemoveCustomLineItemAction[] = deleteOtherPaymentCustomLineItems.map((item: any) => ({
					action: 'removeCustomLineItem',
					customLineItemId: item.id
				}))
	
				cartUpdateActions.push(...removeCustomLineItemActions)
			}
	
			myCartUpdateActions.push({
				action: 'setLineItemCustomField',
				lineItemId,
				name: 'otherPayments',
				value: otherPayments,
			});
		});
	
		let newCart = updatedCart
		let currentVersion = version
		if (myCartUpdateActions.length) {
			newCart = await this.updateCart(cartId, currentVersion, myCartUpdateActions)
			currentVersion = newCart.version
		}
	
		cartUpdateActions.push({
			action: 'setDirectDiscounts',
			discounts: newDirectDiscounts
		})
		newCart = await this.ctCartClient.updateCart(cartId, currentVersion, cartUpdateActions)
	
		return newCart
	}

	async attachBenefitToICart(iCart: any, lineItemWithCampaignBenefits: any[]) {
		const { items } = iCart
		const promises = items.map(async (item: any) => {
			const sku = item.sku
			const lineItem = lineItemWithCampaignBenefits.find((lineItem: any) => lineItem.variant.sku === sku)

			const availableBenefits = lineItem?.availableBenefits || []
			const mappedAvailableBenefits = await this.mapAvailableBenefits(availableBenefits)
			const privilege = lineItem?.privilege || null
			const discounts = lineItem?.discounts || []
			const otherPayments = lineItem?.otherPayments || []

			return {
				...item,
				availableBenefits: mappedAvailableBenefits,
				isRequirePrivilege: !!privilege?.campaignCode,
				privilege,
				discounts,
				otherPayments
			}
		})

		const newItems = await Promise.all(promises)
		const newICart = {
			...iCart,
			items: newItems
		}

		return newICart
	}

	async mapAvailableBenefits(availableBenefits: any[]) {
		const mappedAvailableBenefits = availableBenefits.map((availableBenefit:any) => {
			const { benefitType, freeGiftProducts = [], addOnProducts = [] }=availableBenefit

			const newAddOnProducts: IAvailableBenefitProduct[] = addOnProducts.map((addOnProduct:any) => {
				const {
					id,
					key,
					name,
					productType,
					productSlug,
					variants,
					totalSelectedItem
				} = addOnProduct

				const newVariants: IAvailableBenefitProductVariant[] = variants.map((variant:any) => {
					const {
						attributes,
						images,
						key,
						sku,
						id,
						prices,
						totalSelectedItem,
					} = variant

					const price = this.ctProductClient.findValidPrice({
						prices,
						customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp
					})
					const unitPrice = price?.value.centAmount
					const image = images?.[0] || null
					return {
						attributes,
						image,
						varientkey: key,
						sku,
						varientId: id,
						unitPrice,
						totalSelectedItem,
					}
				})

				const image = getAttributeValue((variants?.[0]?.attributes ?? []), 'image')

				return {
					productId: id,
					productKey: key,
					productName: name,
					ctProductType: productType,
					productSlug: productSlug,
					variants: newVariants,
					image,
					totalSelectedItem
				}
			})

			const newFreeGiftProducts: IAvailableBenefitProduct[] = freeGiftProducts.map((freeGiftProduct:any) => {
				const {
					id,
					key,
					name,
					productType,
					productSlug,
					variants,
					totalSelectedItem
				} = freeGiftProduct

				const newVariants: IAvailableBenefitProductVariant[] = variants.map((variant:any) => {
					const {
						attributes,
						images,
						key,
						sku,
						id,
						prices,
						totalSelectedItem,
					} = variant

					const price = this.ctProductClient.findValidPrice({
						prices,
						customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp
					})
					const unitPrice = price?.value.centAmount
					const image = images?.[0] || null
					return {
						attributes,
						image,
						varientkey: key,
						sku,
						varientId: id,
						unitPrice,
						totalSelectedItem,
					}
				})

				const image = getAttributeValue((variants?.[0]?.attributes ?? []), 'image')

				return {
					productId: id,
					productKey: key,
					productName: name,
					ctProductType: productType,
					productSlug: productSlug,
					variants: newVariants,
					image,
					totalSelectedItem
				}
			})

			return {
				...availableBenefit,
				...(benefitType === 'add_on' ? { addOnProducts: newAddOnProducts } : {}),
				...(benefitType === 'free_gift' ? { freeGiftProducts: newFreeGiftProducts } : {})
			}
		})

		return mappedAvailableBenefits
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

	/**
	 * Main entry for applying Talon.One benefit logic, etc.
	 */
	async updateCartWithBenefit(ctCart: any) {
		// 1) Sync to Talon.One
		await this.talonOneEffectConverter.updateCustomerSession(ctCart)

		// 2) Get line items w/ campaign benefits
		const lineItemWithCampaignBenefits = await this.talonOneEffectConverter.getCtLineItemWithCampaignBenefits(ctCart)

		// 3) Upsert privileges/discounts to CT cart
		const updatedCart = await this.upsertPrivilegeToCtCart(ctCart, lineItemWithCampaignBenefits)

		// 4) Merge inventory, finalize iCart for the final response
		const skus = ctCart.lineItems.map((lineItem: any) => lineItem.variant.sku);
		const inventoryKey = skus.map((sku: any) => sku).join(',');
		const inventories = await this.ctInventoryClient.getInventory(inventoryKey);
		const inventoryMap = new Map<string, any>();
		inventories.forEach((inventory: any) => {
			const key = inventory.key;
			const sku = key.replace(`${this.onlineChannel}-`, '');
			inventoryMap.set(sku, inventory);
		});
		let iCart: ICart = this.mapCartToICart(updatedCart);
		iCart = await this.attachInsuranceToICart(iCart);

		this.mapInventoryToItems(iCart.items, inventoryMap);

		const iCartWithBenefit = this.attachBenefitToICart(iCart, lineItemWithCampaignBenefits)

		return iCartWithBenefit;
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

	async getCartWithBenefit(ctCart: any) {
		const skus = ctCart.lineItems.map((lineItem: any) => lineItem.variant.sku);
		const inventoryKey = skus.map((sku: any) => sku).join(',');
		const inventories = await this.ctInventoryClient.getInventory(inventoryKey);
		const inventoryMap = new Map<string, any>();
		inventories.forEach((inventory: any) => {
			const key = inventory.key;
			const sku = key.replace(`${this.onlineChannel}-`, '');
			inventoryMap.set(sku, inventory);
		});

		let iCart: ICart = this.mapCartToICart(ctCart);
		iCart = await this.attachInsuranceToICart(iCart);

		this.mapInventoryToItems(iCart.items, inventoryMap);

		let iCartWithBenefit = iCart;
		if (ctCart?.lineItems?.length) {
			const lineItemWithCampaignBenefits = await this.talonOneEffectConverter.getCtLineItemWithCampaignBenefits(ctCart);
			iCartWithBenefit = await this.attachBenefitToICart(iCart, lineItemWithCampaignBenefits);
		}

		return iCartWithBenefit;
	}

	async updateCartChangeDataToCommerceTools(ctCartWithUpdated: Cart) {
		return await this.ctCartClient.updateCartWithNewValue(ctCartWithUpdated)
	}
}
