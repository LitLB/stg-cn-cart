// cart/src/middleware/not-found.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { createStandardizedError } from '../utils/error.utils';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    logger.error(`Route not found: ${req.method} ${req.originalUrl}`);

    const error = createStandardizedError({
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: EXCEPTION_MESSAGES.NOT_FOUND,
        errorCode: 'NOT_FOUND'
    });

    next(error);
};