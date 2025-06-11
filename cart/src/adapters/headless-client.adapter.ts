import axios, { AxiosAdapter, AxiosInstance, AxiosRequestHeaders, AxiosResponse } from 'axios'
import { readConfiguration } from "../utils/config.utils";
import { IHLCheckEligibleBody } from '../interfaces/hl.interface';

class HeadlessClientAdapter {
    private readonly client: AxiosInstance
    private readonly hlConfig: any
    constructor() {
        this.hlConfig = readConfiguration().hl
        this.client = axios.create({ baseURL: this.hlConfig.baseUrl })
    }

    public async checkCampaignEligible(headers: AxiosRequestHeaders, body: IHLCheckEligibleBody): Promise<void | AxiosResponse> {
        try {
            const url = '/hl-product/api/v1/campaign/eligible';

            const response: AxiosResponse = await this.client.post(`${url}`, { body }, { headers });

            return response.data
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                return { code: error.response?.status || 500, message: error.message };
            } else {
                return { code: 500, message: 'An unexpected error occurred.' };
            }
        }
    }

}

export const hlClientAdapter = new HeadlessClientAdapter();

export default HeadlessClientAdapter