// src/server/adapters/ct-custom-object-client.ts

import type { ApiRoot, CustomObject, CustomObjectDraft } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from '../adapters/ct-base-client';
import { PAYMENT_OMISE_CONTAINER, PAYMENT_OMISE_KEY_PREFIX, ORDER_ADDITIONAL_INFO, COUPON_INFO_CONTAINER } from '../constants/ct.constant';
import { readConfiguration } from '../utils/config.utils';
import { IOrderAdditional } from '../interfaces/order-additional.interface';
import { logger } from '../utils/logger.utils';

class CommercetoolsCustomObjectClient {
	private static instance: CommercetoolsCustomObjectClient;
	private apiRoot: ApiRoot;
	private projectKey: string;

	private constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
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

	async getPaymentTransaction(cartId: string): Promise<CustomObject> {
		const container = PAYMENT_OMISE_CONTAINER;
		const key = `${PAYMENT_OMISE_KEY_PREFIX}${cartId}`;

		try {
			const existingObject = await this.getCustomObjectByContainerAndKey(container, key);

			return existingObject;
		} catch (err: any) {
			console.error('Error getting payment transaction:', err);
			throw err;
		}
	}

	/**
  * Add a new payment transaction to the Custom Object.
  * Reuses existing get and createOrUpdate methods for efficiency.
  * @param orderId The ID of the order.
  * @param orderAdditional The order Additional to add.
  * @returns The updated or created Custom Object.
  */
	async addOrderAdditional(orderId: string, orderAdditional: IOrderAdditional): Promise<CustomObject> {
		const container = ORDER_ADDITIONAL_INFO;
		const key = orderId;

		try {
			const updatedValue = orderAdditional;

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
					value: orderAdditional,
				};

				const createdObject = await this.createOrUpdateCustomObject(customObjectDraft);

				return createdObject;
			} else {
				// Log and rethrow other errors
				console.error('Error adding order additional:', err);
				throw err;
			}
		}
	}

	async addCouponInformation(cartId: string, couponInformation: any): Promise<CustomObject | void> {
		const container = COUPON_INFO_CONTAINER;
		const key = cartId;
	
		try {
			// หาก couponInformation เป็น undefined ให้ลบ CustomObject
			if (couponInformation === undefined) {
				const existingObject = await this.getCustomObjectByContainerAndKey(container, key);
				if (existingObject) {
					await this.deleteCustomObject(container, key);
					logger.info(`Deleted custom object with key: ${key}`);
				}
				return;
			}
	
			// หาก couponInformation มีค่า ให้ดำเนินการ merge และอัปเดต
			const existingObject = await this.getCustomObjectByContainerAndKey(container, key);
			const updatedValue = this.mergeCouponInformation(existingObject?.value, couponInformation);
			return await this.createOrUpdateCustomObject({ container, key, value: updatedValue });
	
		} catch (error: any) {
			if (error.statusCode === 404) {
				if (couponInformation === undefined) {
					logger.info(`No existing object found, nothing to delete for key: ${key}`);
					return;
				}
				return await this.createOrUpdateCustomObject({
					container,
					key,
					value: couponInformation,
				});
			}
			logger.error('Error adding coupon information:', error);
			throw error;
		}
	}

	private mergeCouponInformation(existingValue: any, newCouponInformation: any[]): any[] {
		// if (Array.isArray(existingValue)) {
		// 	const existingCodes = new Map(existingValue.map((item: any) => [item.code, item]));
		// 	newCouponInformation.forEach((newCoupon: any) => {
		// 		existingCodes.set(newCoupon.code, newCoupon);
		// 	});
		// 	return Array.from(existingCodes.values());
		// }
		if (Array.isArray(existingValue)) {
			return [...newCouponInformation];
		}
		return [...newCouponInformation];
	}
}

export default CommercetoolsCustomObjectClient.getInstance();
