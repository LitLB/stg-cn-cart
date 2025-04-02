// server/adapters/ct-cart-client.ts

import type { ApiRoot, CartUpdate, CartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

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
					queryArgs: { expand: 'custom.fields.couponsInfomation' }
				})
				.execute();

			return response.body;
		} catch (error: any) {
			logger.info('Commercetools updateCart error', error);
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `An error occurred while updating from Commercetools.`,
                errorCode: 'UPDATE_CART_CT_FAILED',
            }
		}
	}
}

export default CommercetoolsCartClient.getInstance();
