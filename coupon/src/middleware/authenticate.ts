// coupon/src/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import CommercetoolsAuthClient from '../adapters/ct-auth-client';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.UNAUTHORIZED,
                statusMessage: 'Authorization token is missing or not valid.',
            }, 'authenticate');
        }

        const accessToken = authHeader.split(' ')[1];
        if (!accessToken) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.UNAUTHORIZED,
                statusMessage: 'Access token is missing.',
            }, 'authenticate');
        }

        const authClient = new CommercetoolsAuthClient();
        const introspectResult = await authClient.introspectToken(accessToken);
        if (!introspectResult.active) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.UNAUTHORIZED,
                statusMessage: 'Invalid or expired token.',
            }, 'authenticate');
        }

        req.accessToken = accessToken;
        return next();
    } catch (error: any) {
        next(error);
    }
}
