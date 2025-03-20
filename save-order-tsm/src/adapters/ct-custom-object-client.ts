// src/server/adapters/ct-custom-object-client.ts

import type { ApiRoot, CustomObject, CustomObjectDraft } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import * as _ from 'lodash';

export class CommercetoolsCustomObjectClient {
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
	) {
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
}

export default CommercetoolsCustomObjectClient.getInstance();
