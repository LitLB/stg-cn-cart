// src/services/cart.service.ts

import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { ICart } from '../interfaces/cart';
import { validateCreateAnonymousCartBody } from '../validators/cart.validator';

export class CartService {
    private commercetoolsMeCartClient: CommercetoolsMeCartClient;

    constructor(private accessToken: string) {
        this.commercetoolsMeCartClient = new CommercetoolsMeCartClient(this.accessToken);
    }

    /**
     * Creates an anonymous cart.
     * @param body - The request body containing campaignGroup and journey.
     * @returns The created cart mapped to ICart interface.
     * @throws Validation errors or cart creation errors.
     */
    public async createAnonymousCart(body: any): Promise<ICart> {
        // Validate the request body
        const { error, value } = validateCreateAnonymousCartBody(body);
        if (error) {
            throw {
                statusCode: 400,
                statusMessage: 'Validation failed',
                data: error.details.map((err: any) => err.message),
            };
        }

        const { campaignGroup, journey } = value;

        // Create the cart
        const cart = await this.commercetoolsMeCartClient.createCart(campaignGroup, journey);

        // Map the cart to ICart interface
        const iCart: ICart = await this.commercetoolsMeCartClient.mapCartToICart(cart);

        return iCart;
    }

    /**
     * Retrieves a cart by its ID.
     * @param id - The cart ID.
     * @param selectedOnly - Whether to include only selected items.
     * @returns The cart with benefit information.
     * @throws Errors if the cart is not found or other issues occur.
     */
    public async getCartById(id: string, selectedOnly: boolean): Promise<any> {
        if (!id) {
            throw {
                statusCode: 400,
                statusMessage: 'Cart ID is required',
            };
        }

        const ctCart = await this.commercetoolsMeCartClient.getCartById(id);

        if (!ctCart) {
            throw {
                statusCode: 404,
                statusMessage: 'Cart not found or has expired',
            };
        }

        console.log('ctCart', ctCart);

        const iCartWithBenefit = await this.commercetoolsMeCartClient.getCartWithBenefit(ctCart, selectedOnly);

        return iCartWithBenefit;
    }
}
