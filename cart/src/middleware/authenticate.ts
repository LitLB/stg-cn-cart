// src/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import CommercetoolsAuthClient from '../adapters/ct-auth-client';
import { createStandardizedError } from '../utils/error.utils';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(createStandardizedError({
                statusCode: 401,
                statusMessage: 'Authorization token is missing or not valid.',
                errorCode: 'AUTH_TOKEN_INVALID'
            }));
        }

        const accessToken = authHeader.split(' ')[1];
        if (!accessToken) {
            return next(createStandardizedError({
                statusCode: 401,
                statusMessage: 'Access token is missing.',
                errorCode: 'ACCESS_TOKEN_MISSING'
            }));
        }

        const authClient = new CommercetoolsAuthClient();
        try {
            const introspectResult = await authClient.introspectToken(accessToken);
            if (!introspectResult.active) {
                return next(createStandardizedError({
                    statusCode: 401,
                    statusMessage: 'Invalid or expired token.',
                    errorCode: 'TOKEN_EXPIRED'
                }));
            }

            req.accessToken = accessToken;
            return next();
        } catch (error: any) {
            return next(createStandardizedError({
                statusCode: 500,
                statusMessage: 'Failed to authenticate request.',
                errorCode: 'AUTHENTICATION_FAILED'
            }));
        }
    } catch (error: any) {
        return next(createStandardizedError({
            statusCode: 500,
            statusMessage: 'Internal Server Error.',
            errorCode: EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR,
        }));
    }
}
