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
                    headers: {
                        'content-type': 'application/json',
                        authorization: headers.authorization,
                        language: headers.language,
                        correlatorid: headers.correlatorid,
                        sessionid: headers.sessionid,
                        sourcesystemid: headers.sourcesystemid,
                        version: headers.version,
                        devicetype: headers.devicetype,
                        platform: headers.platform,
                        browsername: headers.browsername,
                        browserversion: headers.browserversion,
                        osname: headers.osname,
                        useragent: headers.useragent,
                    }
                }
            );

            if (response.data && typeof response.data !== 'object') {
                console.error(`getPromotionBundleNoCampaign:error:${JSON.stringify(response.data)}`);
                return null
            }

            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                if (error.response) {
                    console.error(`getPromotionBundleNoCampaign:error:${JSON.stringify(error.response.data)}`);
                } else {
                    console.error(`getPromotionBundleNoCampaign:error:${JSON.stringify(error)}`);
                }
            } else {
                // format simple error before create log error
                console.error(`getPromotionBundleNoCampaign:error:`, error instanceof Error ? error.message : String(error));
            }
            
            return null
        }
    }
}

export default HeadlessClientAdapter