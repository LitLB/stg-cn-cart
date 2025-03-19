// cart/src/adapters/ct-product-projection-client.ts

import type { ApiRoot, Product, ProductDraft, ProductProjection } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import CommercetoolsInventoryClient from './ct-inventory-client'

class CommercetoolsProductProjectionClient {
	private static instance: CommercetoolsProductProjectionClient;
	private apiRoot: ApiRoot;
	private projectKey: string;
	private readonly ctInventoryClient;

	private constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
		this.ctInventoryClient = CommercetoolsInventoryClient;
	}

	public static getInstance(): CommercetoolsProductProjectionClient {
		if (!CommercetoolsProductProjectionClient.instance) {
			CommercetoolsProductProjectionClient.instance = new CommercetoolsProductProjectionClient();
		}
		return CommercetoolsProductProjectionClient.instance;
	}

	async getProductProjectionByPackageCode (): Promise<ProductProjection> {
		const search = `masterData(staged(variants(attributes(name="akeneo_id" and value in (${akeneoIds}))))) or masterData(staged(masterVariant(attributes(name="akeneo_id" and value in (${akeneoIds})))))`;
		const product = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.productProjections()
			.get({
				queryArgs: {
					where: search.concat(`masterData(staged(variants(attributes(name="akeneo_id" and value in (${akeneoIds}))))) or masterData(staged(masterVariant(attributes(name="akeneo_id" and value in (${akeneoIds})))))`)
				},
			})
			.execute();

		return product.body;
	}
}

export default CommercetoolsProductProjectionClient.getInstance();
