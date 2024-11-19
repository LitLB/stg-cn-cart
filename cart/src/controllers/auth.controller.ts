// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    /**
     * Handles the creation of an anonymous session.
     * Responds with session details or an error message.
     * @param req Express Request object
     * @param res Express Response object
     */
    public createAnonymousSession = async (req: Request, res: Response): Promise<Response> => {
        try {
            const anonymousSession = await this.authService.createAnonymousSession();

            const response = {
                status: 'success',
                data: anonymousSession,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            console.error('Error creating anonymous session:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Internal Server Error',
            });
        }
    };

    /**
    * Handles renewing an anonymous session.
    * @param req Express Request object
    * @param res Express Response object
    */
    public renewAnonymousSession = async (req: Request, res: Response): Promise<Response> => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Refresh token is required.',
                });
            }

            const sessionData = await this.authService.renewAnonymousSession(refreshToken);

            return res.status(200).json({
                status: 'success',
                data: sessionData,
            });
        } catch (error: any) {
            console.error('Error renewing anonymous session:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Internal Server Error',
            });
        }
    };
}
