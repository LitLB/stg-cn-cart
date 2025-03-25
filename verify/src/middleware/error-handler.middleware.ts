// src/middleware/error-handler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/response.type';

/**
 * Global error handling middleware.
 *
 * @param err - The error object.
 * @param req - Express Request object.
 * @param res - Express Response object.
 * @param next - Express NextFunction.
 */
export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction,
): void => {

    const status = err.status || err.statusCode || 500
    const statusCode: string = err.response?.data.code || err.statusCode || "500.9999";
    const statusMessage = err.response?.data.message || err.statusMessage || err.message;
    const errorCodeMessage = err.errorCode || err.statusMessage || err.response?.data.description || err.response?.data.message || "UNKNOWN_ERROR_CODE";
    const errorCode = errorCodeMessage.split(" ").join("_").toUpperCase()

    const response: ApiResponse = {
        statusCode,
        statusMessage,
        errorCode: errorCode || 'UNKNOWN_ERROR_CODE',
        data: err.data ? err.response?.data : undefined,
    };

    res.status(status).json(response);
};



export function transformError(error: any, fnMsg: string, code: string): { statusCode: string; statusMessage: string; errorCode: string } {

    const statusMessages: Record<string, string> = {
        '400.010.0015': 'OTP is not match',
        '400.010.0016': 'OTP is not match for 5 times',
        '400.010.0014': 'OTP has expired',
        400: fnMsg
    };

    const statusCodes: Record<string, string> = {
        '400.009.0003': '400.4001',
        '400.010.0015': '400.4002',
        '400.010.0016': '400.4003',
        '400.010.0014': '400.4004',
        400: code
    };

    if (statusMessages[error.statusCode]) {
        const message = statusMessages[error.statusCode];
        return {
            statusCode: statusCodes[error.statusCode],
            statusMessage: message,
            errorCode: message.replace(/\s+/g, '_').toUpperCase()
        };
    }

    return {
        statusCode: error.statusCode,
        statusMessage: error.statusMessage,
        errorCode: error.errorCode
    };
}