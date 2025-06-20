import axios, { AxiosResponse } from 'axios'
import { readConfiguration } from "../utils/config.utils";

class HeadlessClientAdapter {
    private readonly client: any
    private readonly headlessConfig: any
    constructor() {
        this.headlessConfig = readConfiguration().headless
        this.client = axios.create({ baseURL: this.headlessConfig.baseUrl })
    }

    async checkEligible(body: any, headers: any) {
        const url = '/hl-product/api/v1/campaign/eligible';
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
}

export default HeadlessClientAdapter