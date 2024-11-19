// src/controllers/auth.controller.ts

import { Request, Response } from 'express'
import CommercetoolsAuthClient from '../adapters/ct-auth-client';
import { calculateExpiration } from '../utils/session-utils';

// TODO: Develop AuthController class

export const createAnonymousSession = async (req: Request, res: Response) => {
    try {
        const authClient = new CommercetoolsAuthClient();
        const anonymousSession = await authClient.getAnonymousSession();

        const { expires_in } = anonymousSession;

        const expiredAt = calculateExpiration(expires_in);
        const expiredAtWithBuffer = calculateExpiration(expires_in, 300);

        const response = {
            status: 'success',
            data: {
                ...anonymousSession,
                expiredAt,
                expiredAtWithBuffer,
            },
        }

        return res.status(200).send(response)
    } catch (error: any) {
        console.error('Error creating anonymous session:', error);
        return res.status(500).send('Internal Server Error')
    }
}
