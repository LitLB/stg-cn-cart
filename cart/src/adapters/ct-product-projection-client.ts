// cart/src/adapters/ct-product-projection-client.ts

import type { ApiRoot, ProductProjection } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';

class CommercetoolsProductProjectionClient {
	private static instance: CommercetoolsProductProjectionClient;
	private apiRoot: ApiRoot;
	private projectKey: string;

	private constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
	}

	public static getInstance(): CommercetoolsProductProjectionClient {
		if (!CommercetoolsProductProjectionClient.instance) {
			CommercetoolsProductProjectionClient.instance = new CommercetoolsProductProjectionClient();
		}
		return CommercetoolsProductProjectionClient.instance;
	}

	async getProductProjectionByPackageCodes(packageCodes: string[]): Promise<ProductProjection[]> {
		const updatedPackageCodes = packageCodes.map(packageCode => `"${packageCode}"`).join(',');
		const where = `variants(attributes(name="package_code" and value in (${updatedPackageCodes}))) or masterVariant(attributes(name="package_code" and value in (${updatedPackageCodes})))`;

		const product = await this.apiRoot
			.withProjectKey({ projectKey: this.projectKey })
			.productProjections()
			.get({
				queryArgs: { where }
			})
			.execute();

		return product.body.results;
	}
}

export default CommercetoolsProductProjectionClient.getInstance();
