// src/server/adapters/ct-custom-object-client.ts

import type { ApiRoot, CustomObject } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from '../adapters/ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { logger } from '../utils/logger.utils';
import { COUPON_LIMIT_KEY } from '../constants/ct.constant';

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


    async getCouponLimit(): Promise<{ limitCoupon: number }> {
        const container = "container";
        const key = COUPON_LIMIT_KEY;

        try {
            const existingObject = await this.getCustomObjectByContainerAndKey(container, key);
            if (existingObject && existingObject.value) {
                return existingObject.value;
            } else {
                return { limitCoupon: 0 }
            }
        } catch (error: any) {
            logger.error('Error getting coupon limit:', error);
            throw error;
        }
    }
}

export default CommercetoolsCustomObjectClient.getInstance();
