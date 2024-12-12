// server/adapters/ct-cart-client.ts

import type { ApiRoot, Cart, CartUpdate, CartUpdateAction, MyCartUpdate, MyCartUpdateAction, LineItemDraft } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { logger } from '../utils/logger.utils';

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
		} catch (error) {
			logger.info('Commercetools updateCart error', error);
            throw {
                statusCode: 400,
                statusMessage: `An error occurred while updating from Commercetools.`,
                errorCode: 'UPDATE_CART_CT_FAILED',
            }
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
		externalPrice,
	}: {
		cart: Cart;
		productId: string;
		variantId: number;
		quantity: number;
		productType: string;
		productGroup: number;
		addOnGroup: string;
		externalPrice: {
			currencyCode: string;
			centAmount: number;
		};
	}): Promise<Cart> {
		const { lineItems } = cart;
		const existingLineItem = lineItems.find((item: any) => {
			return (
				item.variant.id === variantId
				&& item.custom?.fields?.productGroup === productGroup
				&& item.custom?.fields?.productType === productType
				&& (!addOnGroup || item.custom?.fields?.addOnGroup === addOnGroup)
			);
		});
		const privilege = existingLineItem?.custom?.fields?.privilege;
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
					...(privilege ? { privilege } : {}),
					...(selected != null ? { selected } : {}),
				},
			},
			externalPrice,
		};

		const updatedCart = await this.addLineItemToCart(
			cart.id,
			cart.version,
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
}

export default CommercetoolsCartClient.getInstance();
