import axios, { AxiosError, AxiosInstance, HttpStatusCode } from 'axios';
import { logger } from '../utils/logger.utils';
import { readConfiguration } from '../utils/config.utils';
import { ReserveMsisdnRequest, ReserveMsisdnResponse } from '../types/services/aprgee.type';
import { createStandardizedError } from '../utils/error.utils';

export const getApiGeeInstance = (): AxiosInstance => {
    const baseURL = readConfiguration().apigee.baseUrl;
    return axios.create({ baseURL: baseURL });
};

export const getToken = async (): Promise<string> => {
    try {
        const endpoint = 'oauth/v3/token';
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

        const apiInstant = getApiGeeInstance();
        const response = await apiInstant.post(
            endpoint,
            {
                grant_type: 'client_credentials',
                client_id: readConfiguration().apigee.clientId,
                client_secret: readConfiguration().apigee.clientSecret,
            },
            {
                headers,
            }
        );

        if (!response.data.accessToken) {
            throw new Error('Failed to get token');
        }

        return response.data.accessToken;
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            const _error = error as AxiosError;
            const message = _error.message;
            logger.error(`getToken:message:${message}`);
            throw _error.message;
        }
        throw error;
    }
};

export const reserveMsisdn = async (
    data: ReserveMsisdnRequest,
    accessToken?: string
): Promise<ReserveMsisdnResponse> => {
    try {
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken || (await getToken())}`,
        };
        const apiInstant = getApiGeeInstance();

        const response = await apiInstant.post<ReserveMsisdnResponse>(
            'productCatalog/v1/reserve',
            data,
            {
                headers,
            }
        );

        return response.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            // !If you need handle error code and message can you update on this (err.response?.data?.code)
            throw createStandardizedError(
                {
                    statusCode: err.status || HttpStatusCode.InternalServerError,
                    statusMessage: err.response?.data?.description || err.code,
                    errorCode: err.response?.data?.code,
                },
                'reserveMsisdn'
            );
        }
        throw err;
    }
};

export const cancelReserveMsisdn = async (
    data: ReserveMsisdnRequest,
    accessToken?: string
): Promise<ReserveMsisdnResponse> => {
    try {
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken || (await getToken())}`,
        };
        const apiInstant = getApiGeeInstance();

        const response = await apiInstant.delete<ReserveMsisdnResponse>(
            'productCatalog/v1/cancelReserve',
            {
                headers,
                data,
            }
        );

        return response.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            // !If you need handle error code and message can you update on this (err.response?.data?.code)
            throw createStandardizedError(
                {
                    statusCode: err.status || HttpStatusCode.InternalServerError,
                    statusMessage: err.response?.data?.description || err.code,
                    errorCode: err.response?.data?.code,
                },
                'cancelReserveMsisdn'
            );
        }
        throw err;
    }
};
