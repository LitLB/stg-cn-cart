// cart/src/controllers/order.controller.ts

import { NextFunction, Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { logger } from '../utils/logger.utils';
import { IOrder } from '../interfaces/order.interface';
import { HTTP_STATUSES } from '../constants/http.constant';

export class OrderController {
    private orderService: OrderService;

    constructor() {
        this.orderService = new OrderService();
    }

    public getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;

            const cart = await this.orderService.getOrderById(id);

            const response: ApiResponse<IOrder> = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: cart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`OrderController.getOrderById.error`, error);

            next(error);
        }
    };
}
