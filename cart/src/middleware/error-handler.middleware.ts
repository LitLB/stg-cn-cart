// src/middleware/error-handler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { HTTP_STATUSES } from '../constants/http.constant';
import { ApiResponse } from '../interfaces/response.interface';

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
    const statusCode = err.statusCode || 500;
    const statusMessage = err.message || EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR;
    const errorCode = HTTP_STATUSES[statusCode] || 'UNKNOWN_ERROR';
    const data = null;

    const response: ApiResponse = {
        statusCode,
        statusMessage,
        errorCode,
        data,
    };

    res.status(statusCode).json(response);
};
