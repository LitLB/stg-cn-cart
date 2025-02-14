// src/middleware/error-handler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.utils';
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
    // Log the error details for debugging
    logger.error('Unhandled Error:', {
        message: err.message || 'Unknown error',
        stack: err.stack || 'No stack trace available',
        status: err.status,
        statusCode: err.statusCode,
        statusMessage: err.statusMessage,
        errorCode: err.errorCode,
        data: err.data,
    });


    // Set default values if not provided
    const statusCode = err.statusCode  || 500;
    const statusMessage = err.message || err.statusMessage;
    const errorCode = err.errorCode || 'UNKNOWN_ERROR_CODE';
    const data = err.data || null;

    // Prepare the error response
    const response: ApiResponse = {
        statusCode,
        statusMessage,
        errorCode,
        data,
    };

    // Send the error response
    res.status(statusCode).json(response);
};
