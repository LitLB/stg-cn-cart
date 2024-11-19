// server/adapters/me/ct-me-order-client.ts

import type { ApiRoot, Order, Cart, OrderFromCartDraft } from '@commercetools/platform-sdk';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/sdk-client-v2';
import { createAuthMiddlewareWithExistingToken } from '@commercetools/sdk-middleware-auth';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';

export default class CommercetoolsMeOrderClient {
	private apiRoot: ApiRoot;
	private projectKey: string;

	constructor(accessToken: string) {
		const config = useRuntimeConfig();
		this.projectKey = config.public.ctpProjectKey as string;

		const client = new ClientBuilder()
			.withProjectKey(this.projectKey)
			.withMiddleware(
				createAuthMiddlewareWithExistingToken(`Bearer ${accessToken}`)
			)
			.withMiddleware(
				createHttpMiddleware({
					host: config.public.ctpApiUrl,
				})
			)
			.build();

		this.apiRoot = createApiBuilderFromCtpClient(client);
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
		};

		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.orders()
				.post({ body: orderDraft })
				.execute();

			return response.body;
		} catch (error) {
			console.error('Error creating order from cart:', error);
			throw error;
		}
	}
}
