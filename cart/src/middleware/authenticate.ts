// src/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import CommercetoolsAuthClient from '../adapters/ct-auth-client';
import { createStandardizedError } from '../utils/error.utils';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { HTTP_STATUSES } from '../constants/http.constant';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(createStandardizedError({
                statusCode: HTTP_STATUSES.UNAUTHORIZED,
                statusMessage: 'Authorization token is missing or not valid.',
                errorCode: 'AUTH_TOKEN_INVALID'
            }));
        }

        const accessToken = authHeader.split(' ')[1];
        if (!accessToken) {
            return next(createStandardizedError({
                statusCode: HTTP_STATUSES.UNAUTHORIZED,
                statusMessage: 'Access token is missing.',
                errorCode: 'ACCESS_TOKEN_MISSING'
            }));
        }

        const authClient = new CommercetoolsAuthClient();
        try {
            const introspectResult = await authClient.introspectToken(accessToken);
            if (!introspectResult.active) {
                return next(createStandardizedError({
                    statusCode: HTTP_STATUSES.UNAUTHORIZED,
                    statusMessage: 'Invalid or expired token.',
                    errorCode: 'TOKEN_EXPIRED'
                }));
            }

            req.accessToken = accessToken;
            return next();
        } catch (error: any) {
            return next(createStandardizedError({
                statusCode: HTTP_STATUSES.INTERNAL_SERVER_ERROR,
                statusMessage: 'Failed to authenticate request.',
                errorCode: 'AUTHENTICATION_FAILED'
            }));
        }
    } catch (error: any) {
        return next(createStandardizedError({
            statusCode: HTTP_STATUSES.INTERNAL_SERVER_ERROR,
            statusMessage: EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR,
            errorCode: EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR,
        }));
    }
}
