import axios, { AxiosResponse } from 'axios'
import { readConfiguration } from "../utils/config.utils";
import { PromotionBundleResponse } from '../interfaces/promotion-bundle.interface';

class HeadlessClientAdapter {
    private readonly client: any
    private readonly headlessConfig: any
    constructor() {
        this.headlessConfig = readConfiguration().headless
        this.client = axios.create({ baseURL: this.headlessConfig.baseUrl })
    }

    async checkEligible(body: any, headers: any) {
        const url = '/api/v1/campaign/eligible';
        const response: AxiosResponse = await this.client.post(
            `${url}`,
            body,
            {
                headers: {
                    'content-type': 'application/json',
                    authorization: headers.authorization,
                    language: headers.language,
                    correlatorid: headers.correlatorid,
                    sessionid: headers.sessionid,
                    sourcesystemid: headers.sourcesystemid,
                    version: headers.version,
                    devicetype: headers.devicetype,
                    platform: headers.platform
                }
            }
        );

        return response.data;
    }

    async getPromotionBundleNoCampaign(sku: string, headers: Record<string, string>): Promise<PromotionBundleResponse | null> {
        try {
            const url = `/api/v1/promotionSet?sku=${sku}`;
            const response: AxiosResponse = await this.client.get(
                `${url}`,
                {
                    headers: headers
                }
            );

            return response.data;
        } catch (error: any) {
            console.error(`getPromotionBundleNoCampaign.error`, error);
            
            return null
        }
    }
}

export default HeadlessClientAdapter