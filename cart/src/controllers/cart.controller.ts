// cart/src/controllers/cart.controller.ts

import { Request, Response } from 'express';
import { CartService } from '../services/cart.service';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';

export class CartController {
    private cartService: CartService;

    constructor() {
        this.cartService = new CartService();
    }

    public createAnonymousCart = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            console.log('createAnonymousCart.b');
            const accessToken = req.accessToken as string;

            const cart = await this.cartService.createAnonymousCart(accessToken, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: cart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            console.log('createAnonymousCart.error', error);
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

    public getCartById = async (req: Request, res: Response): Promise<Response> => {
        try {
            console.log('getCartById.a');

            const { id } = req.params;
            const selectedOnly = req.query.selectedOnly === 'true';
            console.log('selectedOnly', selectedOnly);
            console.log('typeof selectedOnly', typeof selectedOnly);

            const accessToken = req.accessToken as string;

            const cart = await this.cartService.getCartById(accessToken, id, selectedOnly);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: cart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            console.log('getCartById.error', error);

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
