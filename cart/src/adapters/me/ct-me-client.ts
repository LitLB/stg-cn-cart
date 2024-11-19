// server/adapters/me/ct-me-client.ts

import type { ApiRoot } from '@commercetools/platform-sdk';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/sdk-client-v2';
import { createAuthMiddlewareWithExistingToken } from '@commercetools/sdk-middleware-auth';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';

export default class CommercetoolsMeClient {
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
				}),
			)
			.build();

		this.apiRoot = createApiBuilderFromCtpClient(client);
	}

	/**
	 * Fetches the current customer's data.
	 */
	public async getMeCustomer(): Promise<any> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.me()
				.get()
				.execute();

			return response.body;
		} catch (error) {
			console.error('Error fetching customer:', error);
			throw error;
		}
	}
}
