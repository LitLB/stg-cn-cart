import { Request, Response, NextFunction } from 'express';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export async function cart(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(req.accessToken!);
        const cart = await commercetoolsMeCartClient.getCartById(id);

        if (!cart) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'Cart not found or has expired',
            }, 'cart');
        }

        req.cart = cart;
        return next();
    } catch (error: any) {
        next(error);
    }
}
