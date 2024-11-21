// cart/src/controllers/cart-item.controller.ts

import { Request, Response } from 'express';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';
import { CartItemService } from '../services/cart-item.service';

export class CartItemController {
    private cartItemService: CartItemService;

    constructor() {
        this.cartItemService = new CartItemService();
    }

    public addItem = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            console.log('addItem.b');
            const { id, itemId } = req.params;
            const accessToken = req.accessToken as string;

            const cart = await this.cartItemService.addItem(accessToken, id, itemId, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: cart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            console.log('addItem.error', error);
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
