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
        const url = '/api/v1/campaign/eligible';

        const response: AxiosResponse = await this.client.post(
            `${url}`,
            body,
            {
                headers: { 
                    'content-type': 'application/json',
                    "authorization": "Bearer xxxx",
                    "language": "TH",
                    "correlatorid": "f0be7798-f19b-4993-b79f-74c4ecb177fa",
                    "sessionid": "aaaaa",
                    "sourcesystemid": "VECOM",
                    "version": "1",
                    "devicetype": "desktop",
                    "platform": "web"
                }
            }  
        );

        return response.data;
    }
}

export default HeadlessClientAdapter