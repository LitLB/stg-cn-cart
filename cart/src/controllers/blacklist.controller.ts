// cart/src/controllers/blacklist.controller.ts

import { Request, Response } from 'express';
import { BlacklistService } from '../services/blacklist.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ResponseType } from '../types/response.type';
import { logger } from '../utils/logger.utils';
import { sendCustomError } from '../utils/error.utils';

export class BlacklistController {
    private blacklistService: BlacklistService;

    constructor() {
        this.blacklistService = new BlacklistService();
    }

    public checkBlacklist = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const checkBlacklist = await this.blacklistService.checkBlacklist(req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: checkBlacklist,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`BlacklistController.checkBlacklist.error`, error);

            return sendCustomError(res, error);
        }
    };
}
