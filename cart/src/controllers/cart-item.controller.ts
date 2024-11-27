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
            const { id } = req.params;
            const accessToken = req.accessToken as string;
            console.log(id)
            const updatedCart = await this.cartItemService.addItem(accessToken, id, req.body);
            console.log(updatedCart)
            const response: ResponseType = {
                statusCode: 200,
                statusMessage: RESPONSE_MESSAGES.CREATED,
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
            const statusCode = error.statusCode || 500;
            const statusMessage = error.statusMessage || EXCEPTION_MESSAGES.SERVER_ERROR;
            const data = error.data || null

            return res.status(statusCode).json({
                statusCode,
                statusMessage,
                data,
            });
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
            const statusCode = error.statusCode || 500;
            const statusMessage = error.statusMessage || EXCEPTION_MESSAGES.SERVER_ERROR;
            const data = error.data || null

            return res.status(statusCode).json({
                statusCode,
                statusMessage,
                data,
            });
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
