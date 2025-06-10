// server/adapters/ct-cart-client.ts

import type { ApiRoot, Cart, CartUpdate, CartUpdateAction, MyCartUpdate, MyCartUpdateAction, LineItemDraft, LineItem, CartSetCustomFieldAction, CartChangeLineItemQuantityAction, InventoryEntry } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { compareLineItemsArrays } from '../utils/compare.util';
import { getAttributeValue } from '../utils/product-utils';
import { UpdateAction } from '@commercetools/sdk-client-v2';
import { LINE_ITEM_INVENTORY_MODES } from '../constants/lineItem.constant';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client'
import { CustomCartWithCompared, CustomCartWithNotice, CustomLineItemHasChanged, HasChangedAction } from '../types/custom.types';
import { createStandardizedError } from '../utils/error.utils';
import { HttpStatusCode } from 'axios';
import { validateInventory } from '../utils/cart.utils';
import { CART_HAS_CHANGED_NOTICE_MESSAGE, CART_JOURNEYS } from '../constants/cart.constant';
import { IAdapter } from '../interfaces/adapter.interface';
import _ from 'lodash';
import { CommercetoolsStandalonePricesClient } from './ct-standalone-prices-client';



export class CommercetoolsCartClient implements IAdapter {
	public readonly name = 'commercetoolsCartClient' as const
	private static instance: CommercetoolsCartClient;
	private apiRoot: ApiRoot;
	private projectKey: string;

	constructor() {
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
						expand: ['custom.fields.couponsInformation', 'custom.fields.billingAddress'],
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
		journey
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
		journey: string
	}): Promise<Cart> {

		const { lineItems, custom } = cart;

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
			} else if ((isProductPreOrder && isDifferentProductConflict)) {
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
				item.productId === productId
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

		const updateCartCustomFields: CartSetCustomFieldAction[] = [{
			action: 'setCustomField',
			name: 'preOrder',
			value: cartFlag
		}]
		
		// New logic check existing cart journey are 'single_product' and new item journey is 'device_only' we will update cart journey gonna be 'device_only'
		if (custom?.fields?.journey === CART_JOURNEYS.SINGLE_PRODUCT && journey === CART_JOURNEYS.DEVICE_ONLY) {
			updateCartCustomFields.push({
				action: 'setCustomField',
				name: 'journey',
				value: journey
			})
		}

		const cartWithDummyFlag = await this.updateCart(cart.id, cart.version, updateCartCustomFields)
		const transformedCampaignVerifyValues = campaignVerifyValues.map((item: any) => JSON.stringify(item))
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
					...(productType === 'main_product' ? { campaignVerifyValues: transformedCampaignVerifyValues } : {}),
					journey
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
			.post({ body: cartUpdate, queryArgs: { expand: 'custom.fields.couponsInfomation' } })
			.execute();

		return response.body;
	}

	public async updateCartWithNewValue(oldCart: Cart): Promise<CustomCartWithCompared> {
		const { id: cartId, version: cartVersion } = oldCart
		let lineItems = oldCart.lineItems as CustomLineItemHasChanged[]
		const lineItemHasChanged: Record<string, HasChangedAction> = {}
		const updateLineItemQuantityPayload: CartChangeLineItemQuantityAction[] = []

		//Only `main_package`
		lineItems = lineItems.filter((lineItem) => lineItem.custom?.fields?.productType !== 'bundle' || lineItem.custom?.fields?.productType !== 'sim')

		const updateActions: CartUpdateAction[] = lineItems.map((lineItem: CustomLineItemHasChanged) => {
			const { id, price, hasChangedAction } = lineItem
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
		const updateActionAfterRecalculated: CartUpdateAction[] = []

		//Only `main_product`
		recalculatedCart.lineItems.filter((lineItem) => lineItem.custom?.fields?.productType !== 'bundle' && lineItem.custom?.fields?.productType !== 'sim').map(async (lineItem: LineItem) => {

			if(lineItem.variant.sku === undefined) {
				throw createStandardizedError({
					statusCode: HttpStatusCode.BadRequest,
					statusMessage: 'Line item variant SKU is undefined.',
					errorCode: 'LINE_ITEM_VARIANT_SKU_UNDEFINED',
				});
			}

			const standalonePrices = await CommercetoolsStandalonePricesClient.getInstance().getStandalonePricesBySku(lineItem.variant.sku)

			const validPrice = CommercetoolsProductClient.findValidPrice({
				prices: standalonePrices || [],
				customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
				date: new Date(),
			});

			const externalPrice = validPrice.value;

			updateActionAfterRecalculated.push({
				action: 'setLineItemPrice',
				lineItemId: lineItem.id,
				externalPrice,
			})
		})

		const newCart = await this.updateCart(recalculatedCart.id, recalculatedCart.version, updateActionAfterRecalculated)

		const validateProduct = await this.validateDateItems(newCart, lineItemHasChanged)
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

		// Helper to check if the release period is valid
		const isValidPeriod = (releaseDate: Partial<string>, endDate: Partial<string>, now = today) => {
			const validFrom = releaseDate ? new Date(releaseDate) <= now : true;
			const validTo = endDate ? new Date(endDate) >= now : true;
			return validFrom && validTo;
		};

		// Process each line item and return the updated item
		const itemsWithCheckedCondition = lineItems.map((lineItem) => {
			// Calculate the parent quantity based on main product line items.
			const parentQuantity = mainProductLineItems
				.filter((item) => item.productId === lineItem.productId)
				.reduce((sum, item) => sum + item.quantity, 0);

			const { id, quantity, variant } = lineItem;
			// Ensure attributes exists (defaulting to an empty array).
			const { attributes = [], prices } = variant;


			// Retrieve attribute values.
			const releaseDate = getAttributeValue(attributes, 'release_start_date');
			const endDate = getAttributeValue(attributes, 'release_end_date');
			const status = getAttributeValue(attributes, 'status');

			// Determine if the current date falls within the valid period.
			const periodIsValid = isValidPeriod(releaseDate, endDate);

			// If the period is invalid or the status is disabled, mark the line item for removal.
			if (!periodIsValid || (status && status.key === 'disabled')) {
				itemForRemove.push(lineItem);
			}

			// Check if the line item has a recorded change that indicates removal.
			if (lineItemHasChanged[lineItem.id]?.action === 'REMOVE_LINE_ITEM') {
				itemForRemove.push(lineItem);
			}


			// Return the updated line item including computed fields.
			return {
				...lineItem,
				parentQuantity,
				hasChanged: {
					lineItemId: id,
				},
			};


		});

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
		let { lineItems, version, id } = ctCart;
		let notice = "";

		//Only `main_product`
		lineItems = lineItems.filter((lineItem) => lineItem.custom?.fields?.productType !== 'bundle' && lineItem.custom?.fields?.productType !== 'sim')

		// 1. Early exit if no line items
		if (!lineItems || lineItems.length === 0) {
			return { ctCart, notice };
		}

		// 2. Fetch products from Commercetools
		const productIds = [...new Set(lineItems.map((lineItem) => lineItem.productId))];
		const productResponse = await CommercetoolsProductClient.getProductsByIds(productIds);


		if (!productResponse) {
			throw new Error("Products not found in Commercetools response.");
		}

		const products = productResponse.body.results || [];
		const productMap = new Map(products.map((p) => [p.id, p]));

		// 3. Fetch and map inventory
		const skus = lineItems.map((lineItem) => lineItem.variant.sku);
		const inventoryKey = skus.join(",");
		const inventories = await CommercetoolsInventoryClient.getInventory(inventoryKey);

		// 4. Prepare arrays for actions
		const itemsForRemoval: LineItem[] = [];
		const itemsForUpdate: LineItem[] = [];

		// 5. Check each line item
		for (const lineItem of lineItems) {
			const product = productMap.get(lineItem.productId);
			const isProductPublished = product?.published;
			const isPreOrder = lineItem.custom?.fields.isPreOrder;
			const productType = lineItem.custom?.fields.productType ?? "";

			if (productType.includes(['main_product', 'sim', 'add_on'])) {

				const matchedInventory = inventories.find((inv: InventoryEntry) => inv.sku === lineItem.variant.sku);

				const { isDummyStock, isOutOfStock, available } = validateInventory(matchedInventory);

				// A. Not published ⇒ remove
				if (!isProductPublished) {
					notice = CART_HAS_CHANGED_NOTICE_MESSAGE.UNPUBLISH_PRODUCT;
					itemsForRemoval.push(lineItem);
					continue;
				}

				// B. Not preOrder but dummy/out-of-stock ⇒ remove
				if (!isPreOrder && isDummyStock && isOutOfStock) {
					notice = CART_HAS_CHANGED_NOTICE_MESSAGE.OUT_OF_STOCK;
					itemsForRemoval.push(lineItem);
					continue;
                }

				// C. Is preOrder but not out-of-stock or dummy ⇒ update
				if (isPreOrder && !isOutOfStock && !isDummyStock) {

					// D. Is out-of-stock or quantity more than available and available equal to 0
					if (available === 0 && lineItem.quantity > available) {
						itemsForRemoval.push(lineItem);
						notice = CART_HAS_CHANGED_NOTICE_MESSAGE.DUMMY_TO_PHYSICAL_OUT_OF_STOCK;
						continue;
					} else if (available > 0 && lineItem.quantity > available) {
						// E. is out-of-stock but available > 0
						// change to physical and not alert
						itemsForUpdate.push(lineItem);
						notice = CART_HAS_CHANGED_NOTICE_MESSAGE.DUMMY_TO_PHYSICAL_INSUFFICIENT_STOCK;
						continue;
					}

					itemsForUpdate.push(lineItem);
					notice = CART_HAS_CHANGED_NOTICE_MESSAGE.DUMMY_TO_PHYSICAL;
				}
			}


		}

		// 6. If there are items to remove, remove them
		if (itemsForRemoval.length > 0) {
			const removeActions: UpdateAction[] = itemsForRemoval.map((item) => ({
				action: "removeLineItem",
				lineItemId: item.id,
			}));

			const updatedCart = await this.removeItem(version, id, removeActions);
			return { ctCart: updatedCart, notice };
		}

		// 7. If there are items to update, update them
		if (itemsForUpdate.length > 0) {

			const updateActions: MyCartUpdateAction[] = [];

			itemsForUpdate.forEach(lineItem => {
				const action: MyCartUpdateAction = {
					action: 'setLineItemCustomField',
					lineItemId: lineItem.id,
					name: 'isPreOrder',
					value: false,
				};

				updateActions.push(action)
			})

			const updateCustom: CartSetCustomFieldAction = {
				action: "setCustomField",
				name: "preOrder",
				value: false,
			};

			updateActions.push(updateCustom)

			const cartWithDummyFlag = await this.updateCart(id, version, updateActions);

			return { ctCart: cartWithDummyFlag, notice };
		}

		// 8. Otherwise, return original cart with no notice
		return { ctCart, notice: "" };
	}


	public async validateAndRemoveSku(ctCart: Cart): Promise<Cart> {

		const { lineItems, version, id } = ctCart;

		// Identify items that are NOT published (including when isPublished is undefined)
		const itemsForRemoval = lineItems.filter((lineItem: LineItem) => {
			const { attributes } = lineItem.variant
			const skuStatus = getAttributeValue(attributes ?? [], 'status')
			return skuStatus.key === 'disabled'
		});

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

	public async updateCartWithOperator(oldCart: Cart, operator: string): Promise<Cart> {
		const { id: cartId, version: cartVersion } = oldCart
		const updateActions: CartUpdateAction[] = [];
		const updateCustomField: CartSetCustomFieldAction = {
			action: 'setCustomField',
			name: 'operator',
			value: operator
		};
		updateActions.push(updateCustomField);

		return await this.updateCart(cartId, cartVersion, updateActions);
	}

	public async emptyCart(cart: Cart): Promise<any> {
		const actions:any = [];

		// Remove each regular line item
		if (cart.lineItems && cart.lineItems.length > 0) {
			cart.lineItems.forEach(lineItem => {
				actions.push({
				action: 'removeLineItem',
				lineItemId: lineItem.id,
				// Remove the entire quantity; alternatively, you can set a specific quantity
				quantity: lineItem.quantity
				});
			});
		}

		// Remove each custom line item (if any)
		if (cart.customLineItems && cart.customLineItems.length > 0) {
			cart.customLineItems.forEach(customLineItem => {
				actions.push({
				action: 'removeCustomLineItem',
				customLineItemId: customLineItem.id,
				quantity: customLineItem.quantity
				});
			});
		}

		const updatedCart = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.carts()
			.withId({ID: cart.id})
			.post({
				body: {
					version: cart.version, // use the current version of the cart
					actions: actions
				}
			})
			.execute();

		return updatedCart.body
	}

}

export default CommercetoolsCartClient.getInstance();
