import axios, { AxiosResponse } from 'axios'
import { readConfiguration } from "../utils/config.utils";
import { generateTransactionId } from '../utils/date.utils';
import moment from 'moment';

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
            const url = 'oauth/v1/token';
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

    async requestOTP(phoneNumber: string) {
        await this.init()

        const transactionId = generateTransactionId()

        const sendTime = moment().format('YYYY-MM-DD[T]HH:mm:ss.SSS');


        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };

        const url = '/communicationMessage/v1/generateOTP';



        const response: AxiosResponse = await this.client.post(`${url}`, {
            id: transactionId,
            sendTime: sendTime,
            description: "TH",
            channel: "true",
            code: "220594",
            receiver: [
                {
                    phoneNumber: "phoneNumber",
                    relatedParty: {
                        id: "VC-ECOM"
                    }
                }
            ]
        }, { headers });


        return response.data;
    }

    async verifyOTP(refCode: string, phoneNumber: number) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
        };

        const url = 'otp/v1/verify';
        const response: AxiosResponse = await this.client.post(
            `${url}`,
            { refCode, phoneNumber },
            { headers }
        );

        return response.data;
    }
}

export default ApigeeClientAdapter