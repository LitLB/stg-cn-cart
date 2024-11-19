// server/adapters/ct-customer-client.ts

import type { ApiRoot } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';

class CommercetoolsCustomerClient {
	private static instance: CommercetoolsCustomerClient;
	private apiRoot: ApiRoot;
	private projectKey: string;

	constructor() {
		const config = useRuntimeConfig();
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = config.public.ctpProjectKey as string;
	}

	public static getInstance(): CommercetoolsCustomerClient {
		if (!CommercetoolsCustomerClient.instance) {
			CommercetoolsCustomerClient.instance = new CommercetoolsCustomerClient();
		}
		return CommercetoolsCustomerClient.instance;
	}

	/**
	 * Fetches a customer by ID.
	 * @param customerId - The ID of the customer to fetch.
	 */
	public async getCustomerById(customerId: string): Promise<any> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.customers()
				.withId({ ID: customerId })
				.get()
				.execute();

			return response.body;
		} catch (error) {
			console.error('Error fetching customer:', error);
			throw error;
		}
	}

	/**
	 * Updates the customer's customer group.
	 * @param customer - The customer object.
	 * @param customerGroupId - The ID of the customer group to assign.
	 */
	public async updateCustomerGroup(customer: any, customerGroupId: string): Promise<any> {
		try {
			const response = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.customers()
				.withId({ ID: customer.id })
				.post({
					body: {
						version: customer.version,
						actions: [
							{
								action: 'setCustomerGroup',
								customerGroup: {
									typeId: 'customer-group',
									id: customerGroupId,
								},
							},
						],
					},
				})
				.execute();

			return response.body;
		} catch (error) {
			console.error('Error updating customer group:', error);
			throw error;
		}
	}
}

export default CommercetoolsCustomerClient.getInstance();
