// cart/src/controllers/cart-item.controller.ts

import { NextFunction, Request, Response } from 'express';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { CartItemService } from '../services/cart-item.service';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { validateAddItemCartBody } from '../schemas/cart-item.schema';
import { CART_JOURNEYS, CART_OPERATOS } from '../constants/cart.constant';
import { ICartStrategy } from '../interfaces/cart';
import { DeviceBundleExistingCartStrategy } from '../strategies/device-bundle-existing-cart.strategy';
import { SingleProductDeviceOnlyCartStrategy } from '../strategies/single-product-device-only.strategy';

export class CartItemController {
    private cartItemService?: CartItemService<ICartStrategy>;

    constructor() {}

    set cartStrategy(journey: CART_JOURNEYS) {
        switch(journey) {
            case CART_JOURNEYS.DEVICE_BUNDLE_EXISTING:
                this.cartItemService = new CartItemService<DeviceBundleExistingCartStrategy>(DeviceBundleExistingCartStrategy)
                break
            case CART_JOURNEYS.SINGLE_PRODUCT:
                this.cartItemService = new CartItemService<SingleProductDeviceOnlyCartStrategy>(SingleProductDeviceOnlyCartStrategy)
                break
            case CART_JOURNEYS.DEVICE_ONLY:
                this.cartItemService = new CartItemService<SingleProductDeviceOnlyCartStrategy>(SingleProductDeviceOnlyCartStrategy)
                break
            default:
                throw new Error(`Unsupported journey: ${journey}`);
        }
    }

    public addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Select strategy
            const { cart } = req
            this.cartStrategy = cart!.custom?.fields?.journey

            const accessToken = req.accessToken as string;
            // TODO remove when integrate
            if (!req.body.operator) {
                req.body.operator = CART_OPERATOS.TRUE;
            }
            const { error, value } = validateAddItemCartBody(req.body);
            console.log(JSON.stringify(error, null, 2))
            if (error) {
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err:any) => err.message),
                };
            }

            const data = await this.cartItemService?.addItem(accessToken, cart!, value);
            let response: ApiResponse

            if (data?.campaignVerifyKeys) {
                const campaignVerifyKeysData = data
                response = {
                    statusCode: HTTP_STATUSES.OK,
                    statusMessage: RESPONSE_MESSAGES.SUCCESS,
                    data: campaignVerifyKeysData,
                };
            } else {
                const updatedCart = data
                response = {
                    statusCode: HTTP_STATUSES.OK,
                    statusMessage: RESPONSE_MESSAGES.CREATED,
                    data: updatedCart,
                };
            }

            

            res.status(200).json(response);
        } catch (error: any) {
            console.log(error)
            logger.error(`CartItemController.addItem.error`, error);

            next(error);
        }
    };

    public updateItemQuantityById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Select strategy
            const { cart } = req

            this.cartStrategy = cart!.custom?.fields?.journey

            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartItemService?.updateItemQuantityById(accessToken, cart!, req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartItemController.updateItemQuantityById.error`, error);

            next(error);
        }
    }

    public deleteItemById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Select strategy
            const { cart } = req
            this.cartStrategy = cart!.custom?.fields?.journey

            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartItemService?.deleteItemById(accessToken, cart!, req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartItemController.deleteItemById.error`, error);

            next(error);
        }
    }

    public bulkDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Select strategy
            const { cart } = req
            this.cartStrategy = cart!.custom?.fields?.journey
 
            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartItemService?.bulkDelete(accessToken, cart!, req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartItemController.bulkDelete.error`, error);

            next(error);
        }
    };

    public select = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Select strategy
            const { cart } = req
            this.cartStrategy = cart!.custom?.fields?.journey

            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartItemService?.select(accessToken, cart!, req.body);

            const response: ApiResponse = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`CartItemController.select.error`, error);

            next(error);
        }
    };
}
