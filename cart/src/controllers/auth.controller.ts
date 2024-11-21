// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    public createAnonymousSession = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            console.log('createAnonymousSession.a');
            
            const anonymousSession = await this.authService.createAnonymousSession();

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: anonymousSession,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            console.log('createAnonymousSession.error', error);

            const statusCode = error.statusCode || 500;
            const statusMessage = error.statusMessage || EXCEPTION_MESSAGES.SERVER_ERROR;
            const data = error.data || null

            return res.status(statusCode).json({
                statusCode,
                statusMessage,
                data,
            });
        }
    };

    public renewAnonymousSession = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            console.log('renewAnonymousSession.a');
            const { refreshToken } = req.body;

            if (!refreshToken) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Refresh token is required.',
                }
            }

            const anonymousSession = await this.authService.renewAnonymousSession(refreshToken);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: anonymousSession,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            console.log('renewAnonymousSession.b');
            console.log('renewAnonymousSession.error', error);
            const statusCode = error.statusCode || 500;
            const statusMessage = error.statusMessage || EXCEPTION_MESSAGES.SERVER_ERROR;
            const data = error.data || null

            return res.status(statusCode).json({
                statusCode,
                statusMessage,
                data,
            });
        }
    };
}
