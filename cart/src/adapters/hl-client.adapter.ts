import axios, { AxiosResponse } from 'axios'
import { readConfiguration } from "../utils/config.utils";

class HeadlessClientAdapter {
    private readonly client: any
    private readonly headlessConfig: any
    private readonly hlApiKey: string
    constructor() {
        this.headlessConfig = readConfiguration().headless
        this.client = axios.create({ baseURL: this.headlessConfig.baseUrl })
        this.hlApiKey = this.headlessConfig.apiKey
    }

    async checkEligible(body: any, headers: any) {

        const url = '/api/v1/campaign/eligible';

        const response: AxiosResponse = await this.client.post(
            `${url}`,
            body,
            {
                headers: {
                    'ApiKey': this.hlApiKey,
                    ...headers
                }
            }
        );

        return response.data;
    }
}

export default HeadlessClientAdapter