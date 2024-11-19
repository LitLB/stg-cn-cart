// // src/services/cart.service.ts

// import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
// import { validateCreateAnonymousCartBody } from '../validators/cart.validator';

// export class CartService {
//     private commercetoolsMeCartClient: CommercetoolsMeCartClient;

//     constructor() {
//     }

//     public async createAnonymousCart(accessToken: string, campaignGroup: string, journey: string) {
//         try {
//             const { error } = validateCreateAnonymousCartBody({ campaignGroup, journey });
//             if (error) {
//                 throw new Error(error.details.map((err: any) => err.message).join(', '));
//             }

//             this.commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

//             const cart = await this.commercetoolsMeCartClient.createCart(campaignGroup, journey);

//             return cart;
//         } catch (error: any) {
//             console.error('Error in CartService.createAnonymousCart:', error);
//             throw error;
//         }
//     }

//     public async getCartById(accessToken: string, cartId: string, selectedOnly: boolean) {
//         try {
//             this.commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

//             const cart = await this.commercetoolsMeCartClient.getCartById(cartId);

//             if (!cart) {
//                 throw new Error('Cart not found or has expired');
//             }

//             const cartWithBenefit = await this.commercetoolsMeCartClient.getCartWithBenefit(cart, selectedOnly);

//             return cartWithBenefit;
//         } catch (error: any) {
//             console.error('Error in CartService.getCartById:', error);
//             throw error;
//         }
//     }

// }
