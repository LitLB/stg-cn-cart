import axios, { AxiosError, AxiosInstance, HttpStatusCode } from 'axios';
import { readConfiguration } from '../utils/config.utils';
import { createStandardizedError } from '../utils/error.utils';

export type HlVerifyRequest = {
    correlationId: string;
    channel: string;
    dealerCode: string;
    companyCode: string;
    propoId: string;
    activityFunction: string;
    activityFunctionType: string;
    userLogin: string;
    customerInfo: {
        identification: string;
        identificationType: string;
        birthDate: string;
        customerType: string;
        accountType: string;
        requestSubscriber: string;
    };
    validate: {
        name: string;
        function: string[];
    }[];
};

export type HlVerifyResponse = {
    code: string;
    codeType: string;
    description: string;
};

export type HlVerifyError = {
    code: string;
    codeType: string;
    description: string;
    message: {
        messageTh: string;
        messageEn: string;
        messageCode: string;
    };
    correlationId: string;
};

export const getHlVerifyInstance = (): AxiosInstance => {
    const baseURL = readConfiguration().hl.baseUrl;
    return axios.create({ baseURL });
};

export const hlVerifyStatus = async (data: HlVerifyRequest): Promise<HlVerifyResponse> => {
    try {
        const instance = getHlVerifyInstance();
        const response = await instance.post('/validate/v1/verify', data, {
            headers: {
                ApiKey: readConfiguration().hl.apiKey,
            },
            timeout: 90000,
        });

        return response.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            const _error = err as AxiosError<HlVerifyError>;
            throw createStandardizedError(
                {
                    statusCode: _error.status || HttpStatusCode.InternalServerError,
                    statusMessage: _error.response?.data?.description || _error.code,
                    errorCode: _error.response?.data?.code,
                },
                'verifyHLStatus'
            );
        }
        throw err;
    }
};
