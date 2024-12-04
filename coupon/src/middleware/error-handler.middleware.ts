import { Request, Response, NextFunction } from 'express';
import { EXCEPTION_MESSAGES } from '../utils/messages.utils';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Error:', err);

    const statusCode = err.statusCode || 500;
    const statusMessage = err.statusMessage || EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR;
    const data = err.data || null;

    const response = {
        statusCode,
        statusMessage,
        data,
    };

    res.status(statusCode).json(response);
};