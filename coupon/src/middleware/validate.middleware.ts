// cart/src/middleware/validate.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { createStandardizedError } from '../utils/error.utils';
import { ValidationSchemas } from '../interfaces/validate.interface';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { HTTP_STATUSES } from '../constants/http.constant';
import { ERROR_CODES } from '../constants/error.constant';

/**
 * Middleware to validate request components (body, query, params) against provided Joi schemas.
 *
 * @param schemas - An object containing Joi schemas for body, query, and/or params.
 * @returns An Express middleware function.
 */
export function validateRequest(schemas: ValidationSchemas) {
    return (req: Request, res: Response, next: NextFunction) => {
        const validationErrors: string[] = [];

        // Validate Body
        if (schemas.body) {
            const { error, value } = schemas.body.validate(req.body, { abortEarly: false, stripUnknown: true });
            if (error) {
                validationErrors.push(...error.details.map((err) => err.message));
            } else {
                req.body = value;
            }
        }

        // Validate Query
        if (schemas.query) {
            const { error, value } = schemas.query.validate(req.query, { abortEarly: false, stripUnknown: true });
            if (error) {
                validationErrors.push(...error.details.map((err) => err.message));
            } else {
                req.query = value;
            }
        }

        // Validate Params
        if (schemas.params) {
            const { error, value } = schemas.params.validate(req.params, { abortEarly: false, stripUnknown: true });
            if (error) {
                validationErrors.push(...error.details.map((err) => err.message));
            } else {
                req.params = value;
            }
        }

        if (validationErrors.length > 0) {
            const standardizedError = createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: EXCEPTION_MESSAGES.VALIDATION_ERROR,
                errorCode: ERROR_CODES.VALIDATION_ERROR,
                data: validationErrors,
            });
            return next(standardizedError);
        }

        next();
    };
}
