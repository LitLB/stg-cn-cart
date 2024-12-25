// cart/src/controllers/blacklist.controller.ts

import { NextFunction, Request, Response } from 'express';
import { BlacklistService } from '../services/blacklist.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export class BlacklistController {
    private blacklistService: BlacklistService;

    constructor() {
        this.blacklistService = new BlacklistService();
    }

    public checkBlacklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const checkBlacklist = await this.blacklistService.checkBlacklist(req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: checkBlacklist,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`BlacklistController.checkBlacklist.error`, error);

            next(error);
        }
    };
}
