import type { ApiRoot, Cart, CustomLineItem, LineItem, Order, OrderFromCartDraft } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { STATE_ORDER_KEYS } from '../constants/state.constant';
import { ORDER_STATES } from '../constants/order.constant';
import { SHIPMENT_STATES } from '../constants/shipment.constant';
import { PAYMENT_STATES } from '../constants/payment.constant';
import { HTTP_STATUSES } from '../constants/http.constant';
import { IOrder, IOrderImage, IOrderItem } from '../interfaces/order.interface';
import { logger } from '../utils/logger.utils';
import type { CustomObjectDraft, CustomObject } from '@commercetools/platform-sdk';

class CommercetoolsOrderClient {
	private apiRoot: ApiRoot;
	private projectKey: string;

	constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
	}

	public async getOrderById(orderId: string): Promise<Order | null> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.orders()
				.withId({ ID: orderId })
				.get()
				.execute();

			return response.body;
		} catch (error: any) {
			console.error('Error fetching order:', error);
			return null;
		}
	}

	public async getOrderWithExpand(orderId: string, expand: any): Promise<Order | null> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.orders()
				.withId({ ID: orderId })
				.get({
					queryArgs: {expand},
				})
				.execute();

			return response.body;
		} catch (error: any) {
			console.error('Error fetching order:', error);
			return null;
		}
	}
	
	public async updateOrder(orderId: string, data: any): Promise<Order | null> {
		try {
			const { body } = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.orders()
				.withId({ ID: orderId })
				.post({ body: data })
				.execute()
	
			return body
		} catch (error: any) {
			logger.error(`Update order ID ${orderId} ${error}`)
			return null
		}
	}

	public async createOrUpdateCustomObject(customObjectDraft: CustomObjectDraft) {
		let result!: CustomObject;
		try {
			const { body } = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.customObjects()
				.post({ body: customObjectDraft })
				.execute()
	
			return body;
		} catch (error: any) {
			logger.error(`Update CustomObject ${JSON.stringify(customObjectDraft)} ${error}`)
			return result;
		}
	}

	public async getCustomObject(container: string, key: string) {
		let result!: CustomObject;
		try {
			const { body } = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.customObjects()
				.withContainerAndKey({
					container,
					key
				})
				.get()
				.execute()
	
			return body;
		} catch (error: any) {
			logger.warn(`Get custom object by container ${container} and key ${key} ${error}`)
			return result;
		}
	}

	/**
	 * Creates a new Order from a Cart.
	 * @param orderNumber - The reference id for order
	 * @param cart - The Cart object to convert into an Order.
	 * @param tsmSaveOrder - The detail of TSM save order.
	 */
	public async createOrderFromCart(orderNumber: string, cart: Cart, tsmSaveOrder: any): Promise<Order> {
		const { tsmOrderIsSaved, tsmOrderResponse } = tsmSaveOrder || {}
		const orderDraft: OrderFromCartDraft = {
			version: cart.version,
			cart: {
				typeId: 'cart',
				id: cart.id,
			},
			orderNumber,
			orderState: ORDER_STATES.OPEN,
			shipmentState: SHIPMENT_STATES.PENDING,
			paymentState: PAYMENT_STATES.PENDING,
			state: {
				typeId: 'state',
				key: STATE_ORDER_KEYS.ORDER_CREATED,
			},
			custom: {
				type: {
					typeId: 'type',
					key: 'cartOrderCustomType',
				},
				fields: {
					...(tsmOrderIsSaved !== undefined && tsmOrderIsSaved !== null ? { tsmOrderIsSaved } : {}),
					...(tsmOrderResponse ? { tsmOrderResponse } : {})
				}
			}
		};

		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.orders()
				.post({ body: orderDraft })
				.execute();

			return response.body;
		} catch (error: any) {
			console.log('createOrderFromCart.error', error);
			if (
				error.code === 400 &&
				error.body &&
				error.body.errors &&
				error.body.errors.some(
					(err: any) => err.code === 'OutOfStock' || err.message.includes('out of stock')
				)
			) {
				throw {
					statusCode: HTTP_STATUSES.BAD_REQUEST,
					statusMessage: `Cannot place order: Some line items are out of stock.`,
					errorCode: "CREATE_ORDER_ON_CT_FAILED",
				};
			} else {
				throw {
					statusCode: HTTP_STATUSES.INTERNAL_SERVER_ERROR,
					statusMessage: `Cannot create an order on Commercetools. Internal server error.`,
					errorCode: "CREATE_ORDER_ON_CT_FAILED",
				};
			}
		}
	}

	private getVariantImage(lineItem: LineItem): IOrderImage | null {
		if (lineItem.variant.images && lineItem.variant.images.length > 0) {
			return lineItem.variant.images[0];
		}

		return null;
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

	calculateQuantities(items: IOrderItem[]) {
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

	private calculateCustomLineItemsTotalPrice(customLineItems: CustomLineItem[]): number {
		return customLineItems.reduce(
			(total, cli) => total + cli.totalPrice.centAmount,
			0
		);
	}

	/**
	 * Maps the Commercetools Order to a custom IOrder interface.
	 * @param ctOrder - The Commercetools Order object.
	 */
	mapOrderToIOrder(ctOrder: Order): IOrder {
		const items: IOrderItem[] = [...ctOrder.lineItems]
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

				const item: IOrderItem = {
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

		// Process customLineItems (e.g., order-level discounts)
		const customLineItems = ctOrder.customLineItems || [];

		// Use the new function to calculate the total price of custom line items
		const customLineItemsTotalPrice = this.calculateCustomLineItemsTotalPrice(customLineItems);

		// Total price after discount (line items + custom line items)
		const totalPriceAfterDiscount = lineItemsTotalPrice + customLineItemsTotalPrice;

		// Shipping cost
		const shippingCost = ctOrder.shippingInfo?.price?.centAmount || 0;

		// Grand total: totalPriceAfterDiscount plus shipping cost
		const grandTotal = ctOrder.totalPrice.centAmount;

		// Check is that the calculated grandTotal matches the value from the order.
		if (grandTotal !== totalPriceAfterDiscount + shippingCost) {
			logger.warn('Calculated grandTotal does not match ctOrder.totalPrice.centAmount');
		}

		// Calculate total discount: subtotalPrice minus totalPriceAfterDiscount
		const totalDiscount = subtotalPrice - totalPriceAfterDiscount;

		const iOrder: IOrder = {
			orderId: ctOrder.id,
			locale: ctOrder?.locale || null,
			campaignGroup: ctOrder.custom?.fields.campaignGroup,
			journey: ctOrder.custom?.fields.journey,
			subtotalPrice,
			totalDiscount,
			totalPriceAfterDiscount,
			shippingCost,
			grandTotal,
			currencyCode: ctOrder.totalPrice.currencyCode,
			totalQuantity,
			shippingMethod: ctOrder.shippingInfo?.shippingMethod || null,
			paymentMethod: ctOrder.custom?.fields?.paymentMethod || null,
			shippingAddress: ctOrder.shippingAddress || null,
			billingAddress: ctOrder.billingAddress || null,
			quantitiesByProductType,
			items,
			triggeredCampaigns: [],
			appliedEffects: [],
			createdAt: new Date(ctOrder.createdAt),
			updatedAt: new Date(ctOrder.lastModifiedAt),
		};

		return iOrder;
	}
}

export const commercetoolsOrderClient = new CommercetoolsOrderClient();