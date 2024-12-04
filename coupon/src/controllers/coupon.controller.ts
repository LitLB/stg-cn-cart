// coupon/src/controllers/coupon.controller.ts

import { Request, Response } from 'express';
import { CouponService } from '../services/coupon.service';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';

export class CouponController {
    private couponService: CouponService;

    constructor() {
        this.couponService = new CouponService();
    }

    public getCoupons = async (req: Request, res: Response): Promise<Response> => {
        try {
            const coupons = await this.couponService.getCoupons();

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: coupons,
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

    public applyCoupons = async (req: Request, res: Response): Promise<Response> => {
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
            const statusCode = error.statusCode || 500;
            const errorCode = error.errorCode;
            const statusMessage = error.statusMessage || EXCEPTION_MESSAGES.SERVER_ERROR;
            const data = error.data || null

            return res.status(statusCode).json({
                statusCode,
                errorCode,
                statusMessage,
                data,
            });
        }
    };
}
