// cart/src/middleware/not-found.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { createStandardizedError } from '../utils/error.utils';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { logger } from '../utils/logger.utils';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    logger.error(`Route not found: ${req.method} ${req.originalUrl}`);

    const error = createStandardizedError({
        statusCode: 404,
        statusMessage: EXCEPTION_MESSAGES.NOT_FOUND,
        errorCode: 'NOT_FOUND'
    });

    next(error);
};