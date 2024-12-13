// coupon/src/controllers/coupon.controller.ts

import { Request, Response } from 'express';
import { RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';
import { CouponService } from '../services/coupon.service';
import { logger } from '../utils/logger.utils';
import { sendCustomError } from '../utils/error.utils';

export class CouponController {

    private couponService: CouponService;

    constructor() {
        this.couponService = new CouponService();
    }
    public getQueryCoupons = async (req: Request, res: Response): Promise<ResponseType> => {
        try {

            const body = req.body
            const profileId = body.profileId || undefined
            const options = { coupons: true }
            const activeCoupons = await this.couponService.getQueryCoupons(profileId, options);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: activeCoupons
            }
            return res.status(200).json(response);

        } catch (error: any) {
            logger.info(`CouponController.getQueryCoupons.error`, error);

            return sendCustomError(res, error);
        }
    }

    public applyCoupons = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken as string;

            const cart = await this.couponService.applyCoupons(accessToken, id, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: cart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`CouponController.applyCoupons.error`, error);

            return sendCustomError(res, error);
        }
    };
}
