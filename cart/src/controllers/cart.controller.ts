// src/controllers/cart.controller.ts

import { Request, Response } from 'express';
import { CartService } from '../services/cart.service';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';

export class CartController {
    private cartService: CartService;

    constructor() {
        this.cartService = new CartService();
    }

    public createAnonymousCart = async (req: Request, res: Response): Promise<Response> => {
        try {
            const accessToken = req.accessToken as string;
            const { campaignGroup, journey } = req.body;

            const cart = await this.cartService.createAnonymousCart(accessToken, campaignGroup, journey);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: cart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            const response: ResponseType = {
                statusCode: 500,
                statusMessage: EXCEPTION_MESSAGES.SERVER_ERROR,
            };

            return res.status(500).json(response);
        }
    };

    // public getCartById = async (req: Request, res: Response): Promise<Response> => {
    //     try {
    //         const { id } = req.params;
    //         const selectedOnly = req.query.selectedOnly === 'true';

    //         const accessToken = req.accessToken as string;

    //         const cart = await this.cartService.getCartById(accessToken, id, selectedOnly);

    //         const response: ResponseType = {
    //             statusCode: 200,
    //             statusMessage: RESPONSE_MESSAGES.SUCCESS,
    //             data: cart,
    //         };

    //         return res.status(200).json(response);
    //     } catch (error: any) {
    //         const response: ResponseType = {
    //             statusCode: 500,
    //             statusMessage: EXCEPTION_MESSAGES.SERVER_ERROR,
    //         };

    //         return res.status(500).json(response);
    //     }
    // };
}
