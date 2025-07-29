import axios, { AxiosResponse } from 'axios'
import { readConfiguration } from "../utils/config.utils";

class ApigeeClientAdapter {
    private readonly client: any
    private readonly apigeeConfig: any
    private accessToken: any
    constructor() {
        this.apigeeConfig = readConfiguration().apigee
        this.client = axios.create({ baseURL: this.apigeeConfig.baseUrl })
    }

    async init() {
        const { accessToken } = await this.getToken()
        this.accessToken = accessToken
    }

    async getToken(): Promise<any> {
        try {
            const url = 'oauth/v3/token';
            const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

            const response: AxiosResponse = await this.client.post(`${url}`, {
                grant_type: 'client_credentials',
                client_id: this.apigeeConfig.clientId,
                client_secret: this.apigeeConfig.clientSecret,
            }, { headers });

            return response.data
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                // Handle known Axios errors
                return { code: error.response?.status || 500, message: error.message };
            } else {
                // Handle other types of errors
                return { code: 500, message: 'An unexpected error occurred.' };
            }
        }

    }


    async saveOrderOnline(body: any) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
        };

        const url = 'productOrdering/v3/saveOrder';
        const response: AxiosResponse = await this.client.post(
            `${url}`,
            body,
            { headers }
        );

        return response.data;
    }
    
    async makeUsePrivilege(body: any) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            'x-channel': this.apigeeConfig.xChannel,
            Authorization: `Bearer ${this.accessToken}`,
        };

        console.log('----headers-ssd--', headers)
        const url = 'privilege/v2/useWithReserve';
        const response: AxiosResponse = await this.client.post(
            `${url}`,
            body,
            { headers }
        );

        return response.data;
    }
}

export default ApigeeClientAdapter