// src/server/adapters/ct-custom-object-client.ts

import type { ApiRoot, CustomObject, CustomObjectDraft } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from '../adapters/ct-base-client';
import { PAYMENT_OMISE_CONTAINER, PAYMENT_OMISE_KEY_PREFIX } from '~/constants/ct.constant';

class CommercetoolsCustomObjectClient {
	private static instance: CommercetoolsCustomObjectClient;
	private apiRoot: ApiRoot;
	private projectKey: string;

	private constructor() {
		const config = useRuntimeConfig();
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = config.public.ctpProjectKey as string;
	}

	public static getInstance(): CommercetoolsCustomObjectClient {
		if (!CommercetoolsCustomObjectClient.instance) {
			CommercetoolsCustomObjectClient.instance = new CommercetoolsCustomObjectClient();
		}
		return CommercetoolsCustomObjectClient.instance;
	}

	async createOrUpdateCustomObject(
		customObjectDraft: CustomObjectDraft,
	): Promise<CustomObject> {
		const customObject = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.customObjects()
			.post({ body: customObjectDraft })
			.execute();

		return customObject.body;
	}

	async getCustomObjectByContainerAndKey(
		container: string,
		key: string,
	): Promise<CustomObject> {
		const customObject = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.customObjects()
			.withContainerAndKey({ container, key })
			.get()
			.execute();

		return customObject.body;
	}

	async getCustomObjectsByContainer(
		container: string,
	): Promise<CustomObject[]> {
		const response = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.customObjects()
			.get({
				queryArgs: {
					where: `container="${container}"`,
				},
			})
			.execute();

		return response.body.results;
	}

	async deleteCustomObject(container: string, key: string): Promise<void> {
		await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.customObjects()
			.withContainerAndKey({ container, key })
			.delete()
			.execute();
	}

	async updateCustomObjectKey(
		container: string,
		oldKey: string,
		newKey: string,
	): Promise<CustomObject> {
		const customObject = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.customObjects()
			.post({
				body: {
					container,
					key: newKey,
					value: (await this.getCustomObjectByContainerAndKey(container, oldKey)).value,
				},
			})
			.execute();

		await this.deleteCustomObject(container, oldKey);

		return customObject.body;
	}

	/**
  * Add a new payment transaction to the Custom Object.
  * Reuses existing get and createOrUpdate methods for efficiency.
  * @param cartId The ID of the cart.
  * @param paymentTransaction The payment transaction to add.
  * @returns The updated or created Custom Object.
  */
	async addPaymentTransaction(cartId: string, paymentTransaction: any): Promise<CustomObject> {
		const container = PAYMENT_OMISE_CONTAINER;
		const key = `${PAYMENT_OMISE_KEY_PREFIX}${cartId}`;

		try {
			// Attempt to retrieve the existing Custom Object
			const existingObject = await this.getCustomObjectByContainerAndKey(container, key);

			// Ensure that the existing value is an array
			const updatedValue = Array.isArray(existingObject.value)
				? [...existingObject.value, paymentTransaction]
				: [paymentTransaction];

			// Create a new Custom Object Draft with the updated array
			const customObjectDraft: CustomObjectDraft = {
				container,
				key,
				value: updatedValue,
			};

			// Use createOrUpdateCustomObject to overwrite the existing Custom Object
			const updatedObject = await this.createOrUpdateCustomObject(customObjectDraft);

			return updatedObject;
		} catch (err: any) {
			if (err.statusCode === 404) {
				// Custom Object does not exist, create it with the new transaction in an array
				const customObjectDraft: CustomObjectDraft = {
					container,
					key,
					value: [paymentTransaction],
				};

				const createdObject = await this.createOrUpdateCustomObject(customObjectDraft);

				return createdObject;
			} else {
				// Log and rethrow other errors
				console.error('Error adding payment transaction:', err);
				throw err;
			}
		}
	}
}

export default CommercetoolsCustomObjectClient.getInstance();
