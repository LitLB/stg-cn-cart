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
        console.log({ body, headers })
        const url = '/api/v1/campaign/eligible';

        const response: AxiosResponse = await this.client.post(
            `${url}`,
            body,
            { headers }
        );

         return response.data;
    }
}

export default HeadlessClientAdapter