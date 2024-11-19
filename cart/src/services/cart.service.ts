// src/services/cart.service.ts

import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { validateCreateAnonymousCartBody } from '../validators/cart.validator';

export class CartService {
    // private commercetoolsMeCartClient: CommercetoolsMeCartClient;

    public async createAnonymousCart(accessToken: string, campaignGroup: string, journey: string) {
        console.log('accessToken', accessToken);

        // try {
        //     const { error } = validateCreateAnonymousCartBody({ campaignGroup, journey });
        //     if (error) {
        //         throw new Error(error.details.map((err: any) => err.message).join(', '));
        //     }

        //     this.commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

        //     const cart = await this.commercetoolsMeCartClient.createCart(campaignGroup, journey);

        //     return cart;
        // } catch (error: any) {
        //     console.error('Error in CartService.createAnonymousCart:', error);
        //     throw error;
        // }
    }
}
