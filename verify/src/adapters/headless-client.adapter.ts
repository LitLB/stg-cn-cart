import { AxiosRequestConfig } from 'axios';
import { ApiClientService } from '../shared/services/api-client.service';
import { readConfiguration } from "../utils/config.utils";
import hlMocks from './hl-mocks.json'
import {
    VerifyHLRequestBody,
    VerifyHLResponse
} from '../interfaces/hl.interface';

export class HeadlessClientAdapter extends ApiClientService {
    private readonly client: any
    private readonly hlConfig: any
    private accessToken: any
    private readonly config: any
    private hlApiKey: string
    constructor() {
        const config = readConfiguration();
        const baseURL = config.hl.baseUrl;
        const timeout = config.hl?.timeout || 30000; // Use headless specific or default
        const maxRetries = config.hl?.maxRetries; // Use headless specific or default

        super(baseURL, timeout, maxRetries);
        this.hlApiKey = config.hl.apiKey; // This is for 'x-api-key'
    }

    async init() {
        const { accessToken } = await this.getToken()
        this.accessToken = accessToken
    }

    async getToken(): Promise<any> {
       return ""
    }

    preVerify(thaiId: string): Record<string, unknown>{
        return (hlMocks as Record<string, unknown>)[thaiId] as Record<string, unknown>
    }

    async verifyHLStatus(
        body: VerifyHLRequestBody
    ): Promise<VerifyHLResponse> {
        const url = '/validate/v1/verify'; // As per the provided HeadLess spec
        const config: AxiosRequestConfig = {
            headers: {
                'ApiKey': this.hlApiKey,
            },
        };
        const response = await this.post<VerifyHLResponse>(url, body, config);
        return response.data;
    }
}

export const hlClientAdapter = new HeadlessClientAdapter();

export default HeadlessClientAdapter