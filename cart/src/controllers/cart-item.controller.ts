// cart/src/controllers/cart-item.controller.ts

import { Request, Response } from 'express';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ResponseType } from '../types/response.type';
import { CartItemService } from '../services/cart-item.service';
import { logger } from '../utils/logger.utils';
import { sendCustomError } from '../utils/error.utils';

export class CartItemController {
    private cartItemService: CartItemService;

    constructor() {
        this.cartItemService = new CartItemService();
    }

    public addItem = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken as string;
            const updatedCart = await this.cartItemService.addItem(accessToken, id, req.body);
            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`CartItemController.addItem.error`, error);

            return sendCustomError(res, error);
        }
    };

    public updateItemQuantityById = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const { id, itemId } = req.params;
            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartItemService.updateItemQuantityById(accessToken, id, itemId, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`CartItemController.updateItemQuantityById.error`, error);

            return sendCustomError(res, error);
        }
    }

    public deleteItemById = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const { id, itemId } = req.params;
            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartItemService.deleteItemById(accessToken, id, itemId, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`CartItemController.deleteItemById.error`, error);

            return sendCustomError(res, error);
        }
    }

    public bulkDelete = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartItemService.bulkDelete(accessToken, id, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`CartItemController.bulkDelete.error`, error);

            return sendCustomError(res, error);
        }
    };

    public select = async (req: Request, res: Response): Promise<ResponseType> => {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken as string;

            const updatedCart = await this.cartItemService.select(accessToken, id, req.body);

            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
                data: updatedCart,
            };

            return res.status(200).json(response);
        } catch (error: any) {
            logger.info(`CartItemController.select.error`, error);

            return sendCustomError(res, error);
        }
    };
}
