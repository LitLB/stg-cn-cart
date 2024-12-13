// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../constants/messages.utils';
import { ResponseType } from '../types/response.type';
import { logger } from '../utils/logger.utils';
import { formatError } from '../utils/error.utils';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    public createAnonymousSession = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const anonymousSession = await this.authService.createAnonymousSession();

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: anonymousSession,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`AuthController.createAnonymousSession.error`, error);

            const { statusCode, statusMessage, errorCode, data } = formatError(error);
            return res.status(statusCode).json({
                statusCode,
                statusMessage,
                errorCode,
                data,
            });
        }
    };

    public renewAnonymousSession = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const anonymousSession = await this.authService.renewAnonymousSession(req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: anonymousSession,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`AuthController.renewAnonymousSession.error`, error);

            const { statusCode, statusMessage, errorCode, data } = formatError(error);
            return res.status(statusCode).json({
                statusCode,
                statusMessage,
                errorCode,
                data,
            });
        }
    };
}
