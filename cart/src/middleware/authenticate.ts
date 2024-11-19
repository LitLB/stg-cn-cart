// src/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import CommercetoolsAuthClient from '../adapters/ct-auth-client';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                message: 'Authorization token is missing or not valid.',
            });
        }

        const accessToken = authHeader.split(' ')[1];

        if (!accessToken) {
            return res.status(401).json({
                status: 'error',
                message: 'Access token is missing.',
            });
        }

        const authClient = new CommercetoolsAuthClient();

        try {
            const introspectResult = await authClient.introspectToken(accessToken);

            if (!introspectResult.active) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid or expired token.',
                });
            }

            // Attach the accessToken to the request object for later use
            (req as any).accessToken = accessToken;

            next(); // Proceed to the next middleware or route handler
        } catch (error: any) {
            console.error('Error during token introspection:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to authenticate request.',
            });
        }
    } catch (error: any) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Internal Server Error.',
        });
    }
}
