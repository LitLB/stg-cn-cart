// cart/src/services/cart.service.ts

import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { ICart } from '../interface/cart';
import { validateCreateAnonymousCartBody } from '../validators/cart.validator';

export class CartService {
    private commercetoolsMeCartClient: CommercetoolsMeCartClient | null = null;

    public async createAnonymousCart(accessToken: string, body: any) {
        try {
            const { campaignGroup, journey } = body;
            const { error } = validateCreateAnonymousCartBody({ campaignGroup, journey });
            if (error) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err: any) => err.message),
                };
            }

            this.commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await this.commercetoolsMeCartClient.createCart(campaignGroup, journey);

            const iCart: ICart = this.commercetoolsMeCartClient.mapCartToICart(cart);

            return iCart;
        } catch (error: any) {
            console.error('Error in CartService.createAnonymousCart:', error);
            throw error;
        }
    }

    public async getCartById(accessToken: string, id: string, selectedOnly: boolean): Promise<any> {
        try {
            if (!id) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Cart ID is required',
                };
            }

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const ctCart = await commercetoolsMeCartClient.getCartById(id);
            if (!ctCart) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Cart not found or has expired',
                };
            }
            console.log('ctCart', ctCart);

            const iCartWithBenefit = await commercetoolsMeCartClient.getCartWithBenefit(ctCart, selectedOnly);

            return iCartWithBenefit;
        } catch (error: any) {
            console.error('Error in CartService.getCartById:', error);

            throw error;
        }
    };
}
