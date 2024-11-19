// src/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import CommercetoolsAuthClient from '../adapters/ct-auth-client';

declare global {
    namespace Express {
        interface Request {
            accessToken?: string;
        }
    }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                statusCode: 'error',
                statusMessage: 'Authorization token is missing or not valid.',
            });
        }

        const accessToken = authHeader.split(' ')[1];

        if (!accessToken) {
            return res.status(401).json({
                statusCode: 'error',
                statusMessage: 'Access token is missing.',
            });
        }

        const authClient = new CommercetoolsAuthClient();

        try {
            const introspectResult = await authClient.introspectToken(accessToken);

            if (!introspectResult.active) {
                return res.status(401).json({
                    statusCode: 'error',
                    statusMessage: 'Invalid or expired token.',
                });
            }

            // Attach the accessToken to the request object
            req.accessToken = accessToken;

            next(); // Proceed to the next middleware or route handler
        } catch (error: any) {
            console.error('Error during token introspection:', error);
            return res.status(500).json({
                statusCode: 'error',
                statusMessage: 'Failed to authenticate request.',
            });
        }
    } catch (error: any) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            statusCode: 'error',
            statusMessage: 'Internal Server Error.',
        });
    }
}
