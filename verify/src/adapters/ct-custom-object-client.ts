// src/server/adapters/ct-custom-object-client.ts

import type { ApiRoot, CustomObject } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from '../adapters/ct-base-client';
import { CONFIGURATION_CONTAINER, CONFIGURATION_KEY } from '../constants/ct.constant';
import { readConfiguration } from '../utils/config.utils';
import { logger } from '../utils/logger.utils';
import { JourneyActiveOperators } from '../interfaces/ctpConfiguration';

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

	async getJourneyActivationByOperator(): Promise<JourneyActiveOperators[]> {
		try {
			const container = CONFIGURATION_CONTAINER;
			const key = CONFIGURATION_KEY;
			const existingObject = await this.getCustomObjectByContainerAndKey(container, key);
			return existingObject.value;
		} catch (error: any) {
			logger.error('Error getting coupon limit:', error);
			throw error;
		}
	}
}

export default CommercetoolsCustomObjectClient.getInstance();
