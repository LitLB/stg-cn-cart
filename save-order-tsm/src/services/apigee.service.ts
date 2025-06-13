import axios, { AxiosError, AxiosInstance } from "axios";
import { logger } from "../utils/logger.utils";
import { readConfiguration } from "../utils/config.utils";
import { SaveOrderTSMParams } from "../types/services/apigee.type";


export const getApiGeeInstance = (): AxiosInstance => {
    const baseURL = readConfiguration().apigee.baseUrl
    return axios.create({ baseURL: baseURL })
}


export const getToken = async (): Promise<string> => {
    try {
        const endpoint = 'oauth/v3/token'
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

        const apiInstant = getApiGeeInstance()
        const response = await apiInstant.post(endpoint, {
            grant_type: 'client_credentials',
            client_id: readConfiguration().apigee.clientId,
            client_secret: readConfiguration().apigee.clientSecret,
        }, {
            headers
        })

        if (!response.data.accessToken) {
            throw new Error('Failed to get token')
        }
        
        return response.data.accessToken
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            const _error = error as AxiosError
            const message = _error.message
            logger.error(`getToken:message:${message}`)
            throw _error.message
        }
        throw error
    }
}

// TODO: Back to change endpoint
export const saveOrderTSM = async ({
    data,
    accessToken
}: SaveOrderTSMParams): Promise<any> => {
    const endpoint = 'productOrdering/v3/saveOrder'
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken || (await getToken())}`,
    };
    const apiInstant = getApiGeeInstance()
    const response = await apiInstant.post(endpoint, {
        ...data
    }, {
        headers
    })

    return response.data
}