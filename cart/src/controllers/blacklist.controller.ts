// cart/src/controllers/blacklist.controller.ts

import { Request, Response } from 'express';
import { BlacklistService } from '../services/blacklist.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { logger } from '../utils/logger.utils';
import { sendCustomError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export class BlacklistController {
    private blacklistService: BlacklistService;

    constructor() {
        this.blacklistService = new BlacklistService();
    }

    public checkBlacklist = async (req: Request, res: Response): Promise<ApiResponse> => {
        try {
            const checkBlacklist = await this.blacklistService.checkBlacklist(req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
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
