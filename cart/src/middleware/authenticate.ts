// src/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import CommercetoolsAuthClient from '../adapters/ct-auth-client';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        console.log('authenticate.a');
        
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                statusCode: 401,
                statusMessage: 'Authorization token is missing or not valid.',
            });
        }

        const accessToken = authHeader.split(' ')[1];

        if (!accessToken) {
            return res.status(401).json({
                statusCode: 401,
                statusMessage: 'Access token is missing.',
            });
        }

        const authClient = new CommercetoolsAuthClient();

        try {
            const introspectResult = await authClient.introspectToken(accessToken);
            if (!introspectResult.active) {
                return res.status(401).json({
                    statusCode: 401,
                    statusMessage: 'Invalid or expired token.',
                });
            }

            req.accessToken = accessToken;

            next();
        } catch (error: any) {
            return res.status(500).json({
                statusCode: 500,
                statusMessage: 'Failed to authenticate request.',
            });
        }
    } catch (error: any) {
        return res.status(500).json({
            statusCode: 500,
            statusMessage: 'Internal Server Error.',
        });
    }
}
