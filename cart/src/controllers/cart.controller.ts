// cart/src/controllers/cart.controller.ts

import { NextFunction, Request, Response } from 'express';
import { CartService } from '../services/cart.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { logger } from '../utils/logger.utils';
import { CreateAnonymousCartInput } from '../interfaces/create-anonymous-cart.interface';
import { ICart } from '../interfaces/cart';
import { HTTP_STATUSES } from '../constants/http.constant';
import { GetCartByIdInPut } from '../interfaces/get-cart-by-id.interface';
import { HttpStatusCode } from 'axios';
import { createStandardizedError } from '../utils/error.utils';

export class CartController {
    private cartService: CartService;

    constructor() {
        this.cartService = new CartService();
    }

    public test = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken as string;

            const test = await this.cartService.getCurrentAndUpdatedCouponEffects(accessToken, id, req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: test,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartController.test.error`, error);

            next(error);
        }
    };

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

    /**
     * Handles retrieving a cart by ID.
     *
     * @param req - Express Request object with typed query parameters.
     * @param res - Express Response object.
     * @param next - Express NextFunction for error handling.
     */
    public getCartById = async (
        req: Request<{ id: string }, unknown, unknown, GetCartByIdInPut>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { id } = req.params;
            const { selectedOnly = false, includeCoupons = false } = req.query;
            const accessToken = req.accessToken as string;

            const cart = await this.cartService.getCartById(accessToken, id, selectedOnly, includeCoupons);

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
            const { inventorys } = req.body;

            if (inventorys) {
                const cart: ICart = await this.cartService.getCartById(accessToken, id, true, false) || []
                cart?.items.forEach(item => {
                    let cartItemType = '', stockType = ''
                    if (item?.inventory?.isOutOfStock === false) {
                        const inventoryItem = inventorys.find((_item: { inventory: { id: string; }; }) => _item?.inventory?.id === item?.inventory?.id);
                        if (inventoryItem) {
                            if (inventoryItem?.inventory?.stock?.available > 0) cartItemType = 'physical';
                            if (inventoryItem?.inventory?.stock?.totalAvailableDummyStock > 0 && inventoryItem?.inventory?.stock?.totalAvailableDummyStock !== inventoryItem?.inventory?.stock?.totalAvailableDummyPurchaseStock) cartItemType = 'dummy';
                        }
                        if (item?.inventory?.stock?.available > 0) stockType = 'physical';
                        if (item?.inventory?.stock?.totalAvailableDummyStock > 0 && item.inventory.stock.totalAvailableDummyStock !== item.inventory.stock.totalAvailableDummyPurchaseStock) stockType = 'dummy';
                    }
                    if (cartItemType !== stockType) {
                        throw createStandardizedError({
                            statusCode: HttpStatusCode.BadRequest,
                            statusMessage: `StockType has Change ${cartItemType} to ${stockType}`,
                            errorCode: '',
                        });
                    }
                    // throw new Error(`StockType has Change when ${cartItemType} to ${stockType}`);
                    // return { ...item.inventory, cartItemType, stockType };
                });
            }
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

    public checkUpdateCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const accessToken = req.accessToken as string;
            const body = req.body;

            const cart = await this.cartService.checkUpdateCart(accessToken, body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: cart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartController.checkupdatecart.error`, error);
            next(error);
        }
    };
}