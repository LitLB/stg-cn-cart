// server/adapters/ct-cart-client.ts

import type { ApiRoot, Cart, CartUpdate, CartUpdateAction, MyCartUpdate, MyCartUpdateAction, LineItemDraft, LineItem, CartSetCustomFieldAction, CartChangeLineItemQuantityAction } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { compareLineItemsArrays } from '../utils/compare.util';
import { getAttributeValue } from '../utils/product-utils';
import { UpdateAction } from '@commercetools/sdk-client-v2';
import { LINE_ITEM_INVENTORY_MODES } from '../constants/lineItem.constant';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import { CustomCartWithCompared, CustomCartWithNotice, CustomLineItemHasChanged, HasChangedAction } from '../types/custom.types';
import { createStandardizedError } from '../utils/error.utils';
import { HttpStatusCode } from 'axios';



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
					queryArgs: {
						expand: ['custom.fields.couponsInformation'],
					},
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
		campaignVerifyValues,
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
		campaignVerifyValues: [
			{
				name: string;
				value: string;
			}
		];
	}): Promise<Cart> {
		const { lineItems } = cart;

		const existingPreOrderMainProduct = lineItems.find((lineItem: LineItem) =>
			lineItem.custom?.fields?.productType === 'main_product'
		);

		let cartFlag: boolean

		if (existingPreOrderMainProduct) {

			const { productId: existingId, variant } = existingPreOrderMainProduct;
			const isProductPreOrder = existingPreOrderMainProduct.custom?.fields?.isPreOrder

			cartFlag = isProductPreOrder

			// Define conflict conditions
			const isDummyToPhysicalCartConflict = !isProductPreOrder && dummyFlag;
			const isPhysicalToDummyCartConflict = isProductPreOrder && !dummyFlag;
			const isDifferentSkuConflict =
				productId === existingId && variant.id !== variantId;
			const isDifferentProductConflict =
				productId !== existingId 

			// Check conflicts in a clear sequence
			if (isDummyToPhysicalCartConflict) {
				throw createStandardizedError({
					statusCode: HttpStatusCode.BadRequest,
					statusMessage: 'Cannot add dummy product to physical cart.',
					errorCode: 'CONFLICT_DUMMY_TO_PHYSICAL_CART',
				});
			} else if (isPhysicalToDummyCartConflict) {
				throw createStandardizedError({
					statusCode: HttpStatusCode.BadRequest,
					statusMessage: 'Cannot add physical product to dummy cart.',
					errorCode: 'CONFLICT_PHYSICAL_TO_DUMMY_CART',
				});
			} else if (isProductPreOrder && isDifferentSkuConflict) {
				throw createStandardizedError({
					statusCode: HttpStatusCode.BadRequest,
					statusMessage: 'Cannot add a different SKU to the dummy cart.',
					errorCode: 'CONFLICT_SKU_IN_DUMMY_CART',
				});
			}else if((isProductPreOrder && isDifferentProductConflict)) {
				throw createStandardizedError({
					statusCode: HttpStatusCode.BadRequest,
					statusMessage: 'Cannot add a different SKU to the dummy cart.',
					errorCode: 'CONFLICT_SKU_IN_DUMMY_CART',
				});
			}

		} else {
			cartFlag = dummyFlag
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
			value: cartFlag
		};

		const cartWithDummyFlag = await this.updateCart(cart.id, cart.version, [updateCustom])
		const transformedCampaignVerifyValues = campaignVerifyValues.map((item:any) => JSON.stringify(item))
		const lineItemDraft: LineItemDraft = {
			productId,
			variantId,
			inventoryMode: dummyFlag ? LINE_ITEM_INVENTORY_MODES.TRACK_ONLY : LINE_ITEM_INVENTORY_MODES.RESERVE_ON_ORDER,
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
					isPreOrder: dummyFlag,
					...(productType === 'main_product' ? { campaignVerifyValues: transformedCampaignVerifyValues } : {})
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
			.post({ body: cartUpdate , queryArgs: { expand: 'custom.fields.couponsInfomation'} })
			.execute();

		return response.body;
	}

	public async updateCartWithNewValue(oldCart: Cart): Promise<CustomCartWithCompared> {
		const { id: cartId, version: cartVersion } = oldCart
        const lineItems = oldCart.lineItems as CustomLineItemHasChanged[]
        const lineItemHasChanged: Record<string, HasChangedAction> = {}
        const updateLineItemQuantityPayload: CartChangeLineItemQuantityAction[] = []

		const updateActions: CartUpdateAction[] = lineItems.map((lineItem: CustomLineItemHasChanged) => {
			const { id, price, hasChangedAction } = lineItem

            // check if line item has changed
            if (hasChangedAction?.action === 'UPDATE_QUANTITY') {
                const externalPrice = lineItem.price.value;
                updateLineItemQuantityPayload.push({
                    action: 'changeLineItemQuantity',
                    lineItemId: id,
                    quantity: hasChangedAction.updateValue,
                    externalPrice,
                })
            } else if (hasChangedAction?.action === 'REMOVE_LINE_ITEM') {
                lineItemHasChanged[id] = hasChangedAction
            }

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

        let updatedCart: Cart = await this.updatePrice(cartId, cartUpdate)

        if (updateLineItemQuantityPayload.length > 0) {
            updatedCart = await this.updateCart(updatedCart.id, updatedCart.version, updateLineItemQuantityPayload)
        }

		const recalculatedCart = await this.recalculateCart(updatedCart.id, updatedCart.version)
		const validateProduct = await this.validateDateItems(recalculatedCart, lineItemHasChanged)
		const compared = compareLineItemsArrays(oldCart.lineItems, validateProduct.lineItems)

		return { ctCart: validateProduct, compared }
	}

	public async updatePrice(cartId: string, cartUpdate: CartUpdate) {
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

	public async validateDateItems(ctCart: Cart, lineItemHasChanged: Record<string, HasChangedAction>) {
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
			const status = getAttributeValue(itemAttr, 'status')

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

			if (!isValidPeriod || status.key === 'disabled') {
				itemForRemove.push(lineItem)
			} 

            if (lineItemHasChanged[lineItem.id]) {
                const hasChanged = lineItemHasChanged[lineItem.id]
                if (hasChanged.action === 'REMOVE_LINE_ITEM') {
                    itemForRemove.push(lineItem)
                }
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

	public async validateProductIsPublished(ctCart: Cart): Promise<CustomCartWithNotice> {

		const { lineItems, version, id } = ctCart;

		// If no line items, return early or handle accordingly
		if (!lineItems || lineItems.length === 0) {
			return { ctCart, notice: '' }
		}

		// Extract productIds from lineItems and remove duplicates
		const productIds = [...new Set(lineItems.map((lineItem: LineItem) => lineItem.productId))];

		// Fetch products from Commercetools
		const response = await CommercetoolsProductClient.getProductsByIds(productIds);

		if (!response) {
			throw new Error('Products not found in Commercetools response.');
		}

		const products = response.body.results || [];

		// Create a Map for faster lookups: productId -> product
		const productMap = new Map(products.map((p) => [p.id, p]));

		// Map over line items and set isPublished
		// Throw an error (or handle as needed) if product is missing
		const updatedLineItems = lineItems.map((lineItem: LineItem) => {
			const product = productMap.get(lineItem.productId);

			return {
				...lineItem,
				isPublished: product ? product.published : false,
			};
		});

		// Identify items that are NOT published (including when isPublished is undefined)
		const itemsForRemoval = updatedLineItems.filter((item) => !(item.isPublished ?? false));

		// If there are no items to remove, return as is
		if (itemsForRemoval.length === 0) {
			return { ctCart, notice: '' };
		}

		// Build the remove actions
		const removeActions: UpdateAction[] = itemsForRemoval.map((item) => ({
			action: 'removeLineItem',
			lineItemId: item.id,
		}));

		// Execute removals and update the cart
		const updatedCart = await this.removeItem(version, id, removeActions);

		// Add a user-facing notice
		const notice = 'Cart items have changed; some items removed due to unavailability.';

		// Return the updated cart along with a notice
		return { ctCart: updatedCart, notice };

	}

	public async validateAndRemoveSku(ctCart: Cart): Promise<Cart> {

		const { lineItems, version, id } = ctCart;

		// Identify items that are NOT published (including when isPublished is undefined)
		const itemsForRemoval = lineItems.filter((lineItem: LineItem) => {
			const { attributes } = lineItem.variant
			const skuStatus = getAttributeValue(attributes ?? [], 'status')
			return skuStatus.key === 'disabled'
		});

		console.log(`itemsForRemove`)
		console.log({ itemsForRemoval })

		// If there are no items to remove, return as is
		if (itemsForRemoval.length === 0) {
			return ctCart
		}

		// Build the remove actions
		const removeActions: UpdateAction[] = itemsForRemoval.map((item) => ({
			action: 'removeLineItem',
			lineItemId: item.id,
		}));

		// Return the updated cart along with a notice
		const updatedCart: Cart = await this.removeItem(version, id, removeActions);

		return updatedCart

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
