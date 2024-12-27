// coupon/src/controllers/coupon.controller.ts

import { NextFunction, Request, Response } from 'express';
import { RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ApiResponse } from '../types/response.type';
import { CouponService } from '../services/coupon.service';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export class CouponController {
    private couponService: CouponService;

    constructor() {
        this.couponService = new CouponService();
    }

    public applyCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken as string;

            const cart = await this.couponService.applyCoupons(accessToken, id, req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: cart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CouponController.applyCoupons.error`, error);

            next(error);
        }
    };

    public getQueryCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {

            const body = req.body
            const profileId = body.profileId || undefined
            const options = { coupons: true }
            const activeCoupons = await this.couponService.getQueryCoupons(profileId, options);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: activeCoupons
            }
            res.status(200).json(response);

        } catch (error: any) {
            logger.error(`CouponController.getQueryCoupons.error`, error);

            next(error);
        }
    }
}
