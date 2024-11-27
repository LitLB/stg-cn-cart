// cart/src/controllers/blacklist.controller.ts

import { Request, Response } from 'express';
import { BlacklistService } from '../services/blacklist.service';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';

export class BlacklistController {
    private blacklistService: BlacklistService;

    constructor() {
        this.blacklistService = new BlacklistService();
    }

    public checkBlacklist = async (req: Request, res: Response): Promise<Response> => {
        try {

            const checkBlacklist = await this.blacklistService.checkBlacklist(req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: checkBlacklist,
            };

            return res.status(200).json(response);
        } catch (error: any) {
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
