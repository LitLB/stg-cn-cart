// cart/src/services/cart.service.ts

import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
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

            return cart;
        } catch (error: any) {
            console.error('Error in CartService.createAnonymousCart:', error);
            throw error;
        }
    }
}
