
import { Request, Response, NextFunction } from 'express';
import { ResponseType } from '../types/response.type'
import { EXCEPTION_MESSAGES } from '../constants/messages.utils';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    const statusCode = 404;
    const response: ResponseType = {
        statusCode,
        statusMessage: EXCEPTION_MESSAGES.NOT_FOUND,
    };

    res.status(statusCode).json(response);
};