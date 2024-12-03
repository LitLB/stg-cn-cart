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

    public queryCoupons = async (req: Request, res: Response): Promise<Response> => {
        try {
            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: ['a'],
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
            console.log('CartController.applyCoupons');
            const { id } = req.params;
            const accessToken = req.accessToken as string;

            const cart = await this.cartService.applyCoupons(accessToken, id, req.body);

            return res.status(200).json(cart);
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

    public createAnonymousCart = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const accessToken = req.accessToken as string;

            const createdCart = await this.cartService.createAnonymousCart(accessToken, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: createdCart,
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

    public getCartById = async (req: Request, res: Response): Promise<Response> => {
        try {
            const { id } = req.params;
            const selectedOnly = req.query.selectedOnly === 'true';
            const accessToken = req.accessToken as string;

            const cart = await this.cartService.getCartById(accessToken, id, selectedOnly);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: cart,
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

    public checkout = async (req: Request, res: Response): Promise<Response> => {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartService.checkout(accessToken, id, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: updatedCart,
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

    // TODO (CN-CART) /cart/v1/orders
    public createOrder = async (req: Request, res: Response): Promise<Response> => {
        try {
            // TODO: STEP #1 - Validate Request Body
            const accessToken = req.accessToken as string;
            const body = req.body
            const cartId = body.cartId
            const validateList = body.validateList || []
            const payload = {
                cartId
            };
            const order = await this.cartService.createOrder(accessToken, payload, validateList);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: {
                    orderId: order.id
                },
            };

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
