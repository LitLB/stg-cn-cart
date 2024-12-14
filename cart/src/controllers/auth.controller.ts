// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { logger } from '../utils/logger.utils';
import { sendCustomError } from '../utils/error.utils';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    public createAnonymousSession = async (req: Request, res: Response): Promise<ApiResponse> => {
        try {
            const anonymousSession = await this.authService.createAnonymousSession();

            const response: ApiResponse = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: anonymousSession,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`AuthController.createAnonymousSession.error`, error);

            return sendCustomError(res, error);
        }
    };

    public renewAnonymousSession = async (req: Request, res: Response): Promise<ApiResponse> => {
        try {
            const anonymousSession = await this.authService.renewAnonymousSession(req.body);

            const response: ApiResponse = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: anonymousSession,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`AuthController.renewAnonymousSession.error`, error);

            return sendCustomError(res, error);
        }
    };
}
