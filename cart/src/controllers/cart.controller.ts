// cart/src/controllers/cart.controller.ts

import { NextFunction, Request, Response } from 'express';
import { CartService } from '../services/cart.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { logger } from '../utils/logger.utils';
import { CreateAnonymousCartInput } from '../interfaces/create-anonymous-cart.interface';
import { ICart } from '../interfaces/cart';
import { HTTP_STATUSES } from '../constants/http.constant';

export class CartController {
    private cartService: CartService;

    constructor() {
        this.cartService = new CartService();
    }

    /**
     * Handles the creation of an anonymous cart.
     *
     * @param req - Express Request object.
     * @param res - Express Response object.
     * @returns A Promise resolving to a ApiResponse object.
     */
    public createAnonymousCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const accessToken = req.accessToken as string;
            const createAnonymousCartInput: CreateAnonymousCartInput = req.body;

            const createdCart = await this.cartService.createAnonymousCart(accessToken, createAnonymousCartInput);

            const response: ApiResponse<ICart> = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: createdCart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartController.createAnonymousCart.error`, error);

            next(error);
        }
    };

    public getCartById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const selectedOnly = req.query.selectedOnly === 'true';
            const accessToken = req.accessToken as string;

            const cart = await this.cartService.getCartById(accessToken, id, selectedOnly);

            const response: ApiResponse<ICart> = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: cart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartController.getCartById.error`, error);

            next(error);
        }
    };

    public checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartService.checkout(accessToken, id, req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: updatedCart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartController.checkout.error`, error);

            next(error);
        }
    };

    // TODO (CN-CART) /cart/v1/orders
    public createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // TODO: STEP #1 - Validate Request Body
            const accessToken = req.accessToken as string;
            const body = req.body
            const cartId = body.cartId
            const client = body.client
            const validateList = body.validateList || []
            const payload = {
                cartId,
                client
            };

            const order = await this.cartService.createOrder(accessToken, payload, validateList);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: order,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartController.createOrder.error`, error);

            next(error);
        }
    }
}
