// cart/src/middleware/error-handler.middleware.ts

// cart/src/middleware/error-handler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';

/**
 * Custom error handling middleware.
 *
 * @param err - The error object.
 * @param req - Express Request object.
 * @param res - Express Response object.
 * @param next - Express NextFunction.
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const statusMessage = err.statusMessage || EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR;
    const errorCode = err.errorCode || 'UNKNOWN_ERROR';
    const data = err.data || null;

    const response: ApiResponse = {
        statusCode,
        statusMessage,
        errorCode,
        data,
    };

    return res.status(statusCode).json(response);
};
