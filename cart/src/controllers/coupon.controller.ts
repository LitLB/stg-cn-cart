// TODO Move to new folder
// cart/src/controllers/coupon.controller.ts

import { Request, Response } from 'express';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';
import { CouponService } from '../services/coupon.service';

export class CouponController {

    private couponService: CouponService;

    constructor() {
        this.couponService = new CouponService();
    }
       public getQueryCoupons = async (req: Request, res: Response): Promise<Response> => {
        try {

            const body = req.body
            const profileId = body.profileId || undefined
            const options = { coupons : true }
            const activeCoupons = await this.couponService.getQueryCoupons(profileId, options);

            const response : ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: activeCoupons
            }
            return res.status(200).json(response);

        } catch (error: any) {
            const statusCode = error.statusCode || 500;
            const statusMessage = error.statusMessage || EXCEPTION_MESSAGES.SERVER_ERROR;
            const errorCode = error.errorCode;
            const data = error.data || null

            return res.status(statusCode).json({
                statusCode,
                statusMessage,
                errorCode,
                data
            });
        }
    }
}