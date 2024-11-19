// src/controllers/cart.controller.ts

import { Request, Response } from 'express';
import { CartService } from '../services/cart.service';
import { authenticateRequest } from '../services/auth.service';

export class CartController {
    /**
     * Handles the creation of an anonymous cart.
     * @param req - Express Request object.
     * @param res - Express Response object.
     */
    public createAnonymousCart = async (req: Request, res: Response): Promise<Response> => {
        try {
            const accessToken = await authenticateRequest(req);

            const cartService = new CartService(accessToken);

            const body = req.body;

            const iCart = await cartService.createAnonymousCart(body);

            return res.status(200).json({
                status: 'success',
                data: iCart,
            });
        } catch (error: any) {
            console.error('Error creating anonymous cart:', error);
            return res.status(error.statusCode || 500).json({
                status: 'error',
                message: error.statusMessage || 'Internal Server Error',
                data: error.data || null,
            });
        }
    };

    /**
     * Handles retrieving a cart by ID.
     * @param req - Express Request object.
     * @param res - Express Response object.
     */
    public getCartById = async (req: Request, res: Response): Promise<Response> => {
        try {
            const accessToken = await authenticateRequest(req);

            const cartService = new CartService(accessToken);

            const { id } = req.params;
            const selectedOnly = req.query.selectedOnly === 'true';

            const iCartWithBenefit = await cartService.getCartById(id, selectedOnly);

            return res.status(200).json({
                status: 'success',
                data: iCartWithBenefit,
            });
        } catch (error: any) {
            console.error('Error retrieving cart:', error);
            return res.status(error.statusCode || 500).json({
                status: 'error',
                message: error.statusMessage || 'Internal Server Error',
                data: error.data || null,
            });
        }
    };
}
