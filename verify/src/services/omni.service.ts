// src/services/omni.service.ts

import { AxiosRequestConfig } from 'axios';
import { ApiClientService } from '../shared/services/api-client.service';
import { readConfiguration } from '../utils/config.utils';
import {
    VerifyDopaPOPApiResponse,
    VerifyDopaPOPStatusRequestBody
} from '../interfaces/dopa.interface';

/**
 * OmniService
 *
 * Service class for interacting with the OMNI Backend APIs.
 * Extends ApiClientService to leverage common HTTP client functionalities
 * including request retries and standardized error handling.
 */
export class OmniService extends ApiClientService {
    private omniApiKey: string;

    constructor() {
        const config = readConfiguration();
        const baseURL = config.omni.baseUrl;
        const timeout = config.omni?.timeout || 30000; // Use omni specific or default
        const maxRetries = config.omni?.maxRetries || 3; // Use omni specific or default

        super(baseURL, timeout, maxRetries);
        this.omniApiKey = config.omni.apiKey; // This is for 'x-api-key'
    }

    /**
     * Verifies DOPA POP (Proof of Possession) status.
     *
     * @param body - The request body for DOPA POP status verification.
     * @returns A promise that resolves to the AxiosResponse containing the DOPA verification result.
     */
    public async verifyDopaPOPStatus(
        body: VerifyDopaPOPStatusRequestBody
    ): Promise<VerifyDopaPOPApiResponse> {
        const url = '/proxy/verifyDopaPOPstatus'; // As per the provided DOPA spec
        const config: AxiosRequestConfig = {
            headers: {
                'ApiKey': this.omniApiKey,
            },
        };
        const response = await this.post<VerifyDopaPOPApiResponse>(url, body, config);
        return response.data;
    }
}

export const omniService = new OmniService();