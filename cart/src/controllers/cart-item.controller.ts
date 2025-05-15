// cart/src/controllers/cart-item.controller.ts

import { NextFunction, Request, Response } from 'express';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { CartItemService } from '../services/cart-item.service';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { AddItemCartBodyRequest, validateAddItemCartBody } from '../schemas/cart-item.schema';
import { CART_JOURNEYS, CART_OPERATOS } from '../constants/cart.constant';
import { ICartStrategy } from '../interfaces/cart';
import { DeviceBundleExistingCartStrategy } from '../strategies/device-bundle-existing-cart.strategy';
import { SingleProductDeviceOnlyCartStrategy } from '../strategies/single-product-device-only.strategy';
import { Cart } from '@commercetools/platform-sdk';
import { DeviceBundleNewCartStrategy } from '../strategies/device-bundle-new-cart.strategy';
import { DeviceBundlePreToPostCartStrategy } from '../strategies/device-bundle-p2p-cart.strategy';
import { DeviceBundleMNPOneStepCartStrategy } from '../strategies/device-bundle-mnp-1-step-cart.strategy';

export class CartItemController {
    private cartItemService?: CartItemService<ICartStrategy>;

    constructor() {}

    set cartStrategy(journey: CART_JOURNEYS) {
        switch(journey) {
            case CART_JOURNEYS.DEVICE_BUNDLE_NEW:
                this.cartItemService = new CartItemService<DeviceBundleNewCartStrategy>(DeviceBundleNewCartStrategy)
                break
            case CART_JOURNEYS.DEVICE_BUNDLE_P2P:
                this.cartItemService = new CartItemService<DeviceBundlePreToPostCartStrategy>(DeviceBundlePreToPostCartStrategy)
                break
            case CART_JOURNEYS.DEVICE_BUNDLE_EXISTING:
                this.cartItemService = new CartItemService<DeviceBundleExistingCartStrategy>(DeviceBundleExistingCartStrategy)
                break
            case CART_JOURNEYS.SINGLE_PRODUCT:
            case CART_JOURNEYS.DEVICE_ONLY:
                this.cartItemService = new CartItemService<SingleProductDeviceOnlyCartStrategy>(SingleProductDeviceOnlyCartStrategy)
                break
            case CART_JOURNEYS.DEVICE_BUNDLE_MNP_1_STEP:
                this.cartItemService = new CartItemService<DeviceBundleMNPOneStepCartStrategy>(DeviceBundleMNPOneStepCartStrategy)
                break
            default:
                throw new Error(`Unsupported journey: ${journey}`);
        }
    }    

    public addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const accessToken = req.accessToken as string;
            
            // Select strategy
            const { cart } = req
            this.cartStrategy = cart?.custom?.fields?.journey as CART_JOURNEYS; 

            // TODO remove when integrate
            if (!req.body.operator) {
                req.body.operator = CART_OPERATOS.TRUE;
            }
            
            // Validation request body first.
            const { error, value } = validateAddItemCartBody(req.body);
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

    // private strategyJourney = async (cart: Cart, body: AddItemCartBodyRequest): Promise<string> => {
    //     const journey = cart.custom?.fields?.journey;
      
    //     if (
    //       cart.lineItems.length > 0 ||
    //       (body.journey && body.journey === journey) ||
    //       (body.journey === '' && journey === CART_JOURNEYS.SINGLE_PRODUCT)
    //     ) {
    //       return journey;
    //     }

    //     return body.journey === '' ? CART_JOURNEYS.SINGLE_PRODUCT : body.journey || journey;
    // };  
}
