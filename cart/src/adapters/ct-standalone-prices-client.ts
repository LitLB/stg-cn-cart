// cart/src/adapters/ct-standalone-prices-client.ts

import type { ApiRoot, StandalonePrice } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';

export class CommercetoolsStandalonePricesClient {
    public readonly name = 'commercetoolsStandalonePricesClient' as const
    private static instance: CommercetoolsStandalonePricesClient;
    private apiRoot: ApiRoot;
    private projectKey: string;

    constructor() {
        this.apiRoot = CommercetoolsBaseClient.getApiRoot();
        this.projectKey = readConfiguration().ctpProjectKey as string;
    }

    public static getInstance(): CommercetoolsStandalonePricesClient {
        if (!CommercetoolsStandalonePricesClient.instance) {
            CommercetoolsStandalonePricesClient.instance = new CommercetoolsStandalonePricesClient();
        }
        return CommercetoolsStandalonePricesClient.instance;
    }

    async getStandalonePricesBySku(sku: string): Promise<StandalonePrice[]> {
        const where = `sku="${sku}"`;

        const product = await this.apiRoot
            .withProjectKey({ projectKey: this.projectKey })
            .standalonePrices()
            .get({
                queryArgs: { where }
            })
            .execute();

        return product.body.results;
    }
}

export default CommercetoolsStandalonePricesClient.getInstance();
