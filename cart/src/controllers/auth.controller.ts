// src/controllers/auth.controller.ts

import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    public createAnonymousSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const anonymousSession = await this.authService.createAnonymousSession();

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: anonymousSession,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`AuthController.createAnonymousSession.error`, error);

            next(error);
        }
    };

    public renewAnonymousSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const anonymousSession = await this.authService.renewAnonymousSession(req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: anonymousSession,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`AuthController.renewAnonymousSession.error`, error);

            next(error);
        }
    };
}
