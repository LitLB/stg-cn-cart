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

    // Set default values if not provided
    const status = err.status || err.statusCode || 500
    const statusCode: string = err.statusCode || err.response.data.code || "500.9999";
    const statusMessage = err.statusMessage || err.response.data.message || err.message;
    const errorCodeMessage = err.errorCode || err.statusMessage ||  err.response.data?.description || err.response.data?.message || 'UNKNOWN_ERROR_CODE'
    const errorCode = errorCodeMessage.split(" ").join("_").toUpperCase();


    const response: ApiResponse = {
        statusCode,
        statusMessage,
        errorCode,
        data: err.data ? err.response.data : null,
    };

    res.status(status).json(response);
};
