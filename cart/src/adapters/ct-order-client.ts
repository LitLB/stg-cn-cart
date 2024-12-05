import type { ApiRoot, Cart, Order, OrderFromCartDraft } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { STATE_ORDER_KEYS } from '../constants/state.constant';

class CommercetoolsOrderClient {
	private apiRoot: ApiRoot;
	private projectKey: string;

	constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
	}

	public async getOrderById(orderId: string) {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.orders()
				.withId({ ID: orderId })
				.get({
					queryArgs: {
						expand: 'paymentInfo.payments[*]',
					},
				})
				.execute();

			return response.body;
		} catch (error) {
			console.error('Error fetching order:', error);
			throw error;
		}
	}

	/**
	 * Creates a new Order from a Cart.
	 * @param cart - The Cart object to convert into an Order.
	 */
	public async createOrderFromCart(cart: Cart): Promise<Order> {
		const orderDraft: OrderFromCartDraft = {
			version: cart.version,
			cart: {
				typeId: 'cart',
				id: cart.id,
			},
			orderState: 'Open',
			shipmentState: 'Pending',
			paymentState: 'Pending',
			state: {
				typeId: 'state',
				key: STATE_ORDER_KEYS.ORDER_CREATED,
			},
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
					statusCode: 400,
					statusMessage: `Cannot place order: Some line items are out of stock.`,
					errorCode: "CREATE_ORDER_ON_CT_FAILED",
				};
			} else {
				throw {
					statusCode: 500,
					statusMessage: `Cannot create an order on Commercetools. Internal server error.`,
					errorCode: "CREATE_ORDER_ON_CT_FAILED",
				};
			}
		}
	}
}

export const commercetoolsOrderClient = new CommercetoolsOrderClient();