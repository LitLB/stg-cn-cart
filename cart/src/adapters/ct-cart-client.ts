// server/adapters/ct-cart-client.ts

import type { ApiRoot, Cart, CartUpdate, CartUpdateAction, MyCartUpdate, MyCartUpdateAction, LineItemDraft, LineItem,CartSetCustomFieldAction } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { compareLineItemsArrays } from '../utils/compare.util';
import { getAttributeValue } from '../utils/product-utils';
import { UpdateAction } from '@commercetools/sdk-client-v2';

class CommercetoolsCartClient {
	private static instance: CommercetoolsCartClient;
	private apiRoot: ApiRoot;
	private projectKey: string;

	private constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;

	}

	public static getInstance(): CommercetoolsCartClient {
		if (!CommercetoolsCartClient.instance) {
			CommercetoolsCartClient.instance = new CommercetoolsCartClient();
		}
		return CommercetoolsCartClient.instance;
	}

	async updateCart(
		cartId: string,
		version: number,
		actions: CartUpdateAction[],
	) {
		try {
			const cartUpdate: CartUpdate = {
				version,
				actions,
			};



			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.carts()
				.withId({ ID: cartId })
				.post({
					body: cartUpdate,
				})
				.execute();



			return response.body;
		} catch (error: any) {
			console.error(`updateCart.error`, error);
			throw error;
		}
	}

	/**
   * Adds an item to the current user's cart.
   * @param cart - The current cart object.
   * @param productId - The ID of the product to add.
   * @param variantId - The variant ID of the product.
   * @param quantity - The quantity to add.
   */
	public async addItemToCart({
		cart,
		productId,
		variantId,
		quantity,
		productType,
		productGroup,
		addOnGroup,
		freeGiftGroup,
		externalPrice,
		dummyFlag,
	}: {
		cart: Cart;
		productId: string;
		variantId: number;
		quantity: number;
		productType: string;
		productGroup: number;
		addOnGroup: string;
		freeGiftGroup: string;
		externalPrice: {
			currencyCode: string;
			centAmount: number;
		};
		dummyFlag: boolean,
	}): Promise<Cart> {
		const { lineItems } = cart;


		const cartFlag = cart.custom?.fields.preOrder;


		if (cartFlag || dummyFlag) {
			const existingMainProduct = lineItems.find((lineItem: LineItem) =>
				lineItem.custom?.fields?.productType === 'main_product' 
			);

			if (existingMainProduct) {
				if (productType === 'main_product') {
					const { variant,productId:existingId } = existingMainProduct;
					// If the cart flag or variant ID doesn't match, throw an error
					if (cartFlag !== dummyFlag || variant?.id !== variantId || productId !== existingId) {
						throw new Error('Cannot add different stock types in the same cart.');
					}
				}
			}
		}

		
		
		const existingLineItem = lineItems.find((item: any) => {
			return (
				item.productId === productId // TODO: Free Gift Changes
				&& item.variant.id === variantId
				&& item.custom?.fields?.productGroup === productGroup
				&& item.custom?.fields?.productType === productType
				&& (!addOnGroup || item.custom?.fields?.addOnGroup === addOnGroup)
				&& (!freeGiftGroup || item.custom?.fields?.freeGiftGroup === freeGiftGroup)
			);
		});


		const privilege = existingLineItem?.custom?.fields?.privilege;
		const discounts = existingLineItem?.custom?.fields?.discounts;
		const otherPayments = existingLineItem?.custom?.fields?.otherPayments;
		const selected = existingLineItem?.custom?.fields?.selected;

		if (existingLineItem) {

			const externalPrice = existingLineItem.price.value;
			const updatedCart = await this.updateCart(cart.id, cart.version, [{
				action: 'changeLineItemQuantity',
				lineItemId: existingLineItem.id,
				quantity: existingLineItem.quantity + quantity,
				externalPrice,
			}]);

			return updatedCart;
		}

			
		const updateCustom: CartSetCustomFieldAction = {
			action: 'setCustomField',
			name: 'preOrder',
			value: cart.custom?.fields.preOrder ? true : dummyFlag
		};


		const cartWithDummyFlag = await this.updateCart(cart.id,cart.version, [updateCustom])



		const lineItemDraft: LineItemDraft = {
			productId,
			variantId,
			quantity,
			supplyChannel: {
				typeId: 'channel',
				id: readConfiguration().ctpSupplyChannel,
			},
			custom: {
				type: {
					typeId: 'type',
					key: 'lineItemCustomType',
				},
				fields: {
					productType,
					productGroup,
					addOnGroup,
					freeGiftGroup,
					...(privilege ? { privilege } : {}),
					...(selected != null ? { selected } : {}),
					...(discounts?.length ? { discounts } : {}),
					...(otherPayments?.length ? { otherPayments } : {}),
				},
			},
			externalPrice,
		};


		const updatedCart = await this.addLineItemToCart(
			cartWithDummyFlag.id,
			cartWithDummyFlag.version,
			lineItemDraft,
		);


		return updatedCart;
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
		lineItemDraft: LineItemDraft,
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
			.carts()
			.withId({ ID: cartId })
			.post({ body: cartUpdate })
			.execute();

		return response.body;
	}

	public async updateCartWithNewValue(oldCart: Cart) {
		const { id: cartId, version: cartVersion, lineItems } = oldCart
		const updateActions: CartUpdateAction[] = lineItems.map((lineItem: any) => {
			const { id, price } = lineItem
			return {
				action: 'setLineItemPrice',
				lineItemId: id,
				externalPrice: {
					currencyCode: "THB",
					centAmount: price.value.centAmount
				}
			}
		})
		const cartUpdate: CartUpdate = {
			version: cartVersion,
			actions: updateActions
		};
		const updatedPrice = await this.updatePrice(cartId, cartUpdate)
		const recalculatedCart = await this.recalculateCart(updatedPrice.id, updatedPrice.version)
		const validateProduct = await this.validateDateItems(recalculatedCart)
		const compared = compareLineItemsArrays(oldCart.lineItems, validateProduct.lineItems)
		return { ...validateProduct, compared }
	}

	public async updatePrice(cartId: string, cartUpdate: any) {
		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.carts()
			.withId({ ID: cartId })
			.post({ body: cartUpdate })
			.execute();
		return response.body
	}

	public async recalculateCart(cartId: string, cartVersion: number) {
		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.carts()
			.withId({ ID: cartId })
			.post({
				body: {
					version: cartVersion,
					actions: [
						{
							action: "recalculate",
							updateProductData: true
						}
					]
				}
			})
			.execute();
		return response.body;
	}

	public async validateDateItems(ctCart: Cart) {
		const today = new Date();
		const { lineItems, totalLineItemQuantity, version, id } = ctCart
		if (!totalLineItemQuantity) return ctCart

		const mainProductLineItems = lineItems.filter(
			(item: LineItem) => item.custom?.fields?.productType === 'main_product',
		);

		const itemForRemove: LineItem[] = []

		const itemsWithCheckedCondition = lineItems.map(lineItem => {

			const parentQuantity = mainProductLineItems
				.filter((item: LineItem) => item.productId === lineItem.productId)
				.reduce((sum: any, item: any) => sum + item.quantity, 0);

			const { variant } = lineItem
			const { attributes } = variant

			const itemAttr = attributes ?? []

			const releaseDate = getAttributeValue(itemAttr, 'release_start_date')
			const endDate = getAttributeValue(itemAttr, 'release_end_date')

			const validForm = new Date(releaseDate) <= today
			const validTo = new Date(endDate) >= today

			let isValidPeriod = true

			if (releaseDate && endDate) {
				isValidPeriod = validForm && validTo
			} else if (releaseDate && !endDate) {
				isValidPeriod = validForm
			} else if (!releaseDate && endDate) {
				isValidPeriod = validTo
			}

			if (!isValidPeriod) {
				itemForRemove.push(lineItem)
			}

			return {
				...lineItem, parentQuantity, hasChanged: {
					lineItemId: lineItem.id,
				}
			}
		})
		if (itemForRemove.length > 0) {
			const removeActions: UpdateAction[] = itemForRemove.map(item => {
				return {
					action: 'removeLineItem',
					lineItemId: item.id,
				};
			})
			return await this.removeItem(version, id, removeActions)
		}
		return { ...ctCart, lineItems: itemsWithCheckedCondition }
	}

	public async removeItem(cartVersion: number, cartId: string, actions: any) {

		const cartUpdate: CartUpdate = {
			version: cartVersion,
			actions
		};

		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.carts()
			.withId({ ID: cartId })
			.post({ body: cartUpdate })
			.execute();

		return response.body

	}

}

export default CommercetoolsCartClient.getInstance();
