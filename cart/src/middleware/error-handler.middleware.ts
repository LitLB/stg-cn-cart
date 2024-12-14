// cart/src/middleware/error-handler.middleware.ts

import { Request, Response } from 'express';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { logger } from '../utils/logger.utils';

export const errorHandler = (err: any, req: Request, res: Response) => {
    logger.error('Unhandled Error:', err);

    const statusCode = err.statusCode || 500;
    const statusMessage = err.statusMessage || EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR;
    const errorCode = err.errorCode;
    const data = err.data || null;

    const response = {
        statusCode,
        statusMessage,
        errorCode,
        data,
    };

    return res.status(statusCode).json(response);
};
