// server/adapters/ct-cart-client.ts

import type { ApiRoot, Cart, CartUpdate, CartUpdateAction, MyCartUpdate, MyCartUpdateAction, LineItemDraft, LineItem, CartSetCustomFieldAction, CartChangeLineItemQuantityAction } from '@commercetools/platform-sdk';
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
import CommercetoolsMeCartClient from './me/ct-me-cart-client';
import { validateInventory } from '../utils/cart.utils';



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

		const updateCustom: CartSetCustomFieldAction = {
			action: 'setCustomField',
			name: 'preOrder',
			value: cartFlag
		};

		const cartWithDummyFlag = await this.updateCart(cart.id, cart.version, [updateCustom])
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
			.post({ body: cartUpdate, queryArgs: { expand: 'custom.fields.couponsInfomation' } })
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

		// console.log(JSON.stringify(recalculatedCart.lineItems, null, 2))
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

			// Get the valid price using the commerce tools client.
			const price = CommercetoolsProductClient.findValidPrice({
				prices: prices || [],
				customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
				date: new Date(),
			});

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
				price,
				totalPrice: {
					...price.value,
					centAmount: price.value.centAmount * quantity,
				},
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
		const { lineItems, version, id } = ctCart;
		let notice = "";

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
			const isProductPublished = product?.priceMode ?? false;
			const isPreOrder = lineItem.custom?.fields.isPreOrder;

			const matchedInventory = inventories.find((inv: any) => inv.sku === lineItem.variant.sku);
			const { isDummyStock, isOutOfStock, available } = validateInventory(matchedInventory);



			// A. Not published ⇒ remove
			if (!isProductPublished) {
				notice = "The cart items have changed; some items have been removed, and the course items have been unpublished.";
				itemsForRemoval.push(lineItem);
				continue;
			}

			// B. Not preOrder but dummy/out-of-stock ⇒ remove
			if (!isPreOrder && isDummyStock && isOutOfStock) {
				notice = "The items in the cart have changed; some have been removed, and the stock type has been updated.";
				itemsForRemoval.push(lineItem);
				continue;
			}

			// C. Is preOrder but not out-of-stock or dummy ⇒ update
			if (isPreOrder && !isOutOfStock && !isDummyStock) {

				// D. Is out-of-stock or quantity more than available
				if (lineItem.quantity > available) {
					itemsForRemoval.push(lineItem);
					notice = "The items in the cart have changed; some have been removed, and insufficient stock item in cart > available";
					continue;
				}

				itemsForUpdate.push(lineItem);
				notice = "Cart change type from Dummy to physical.";
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


}

export default CommercetoolsCartClient.getInstance();
