// cart/src/services/cart.service.ts

import { CartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
// import CommercetoolsMeOrderClient from '../adapters/me/ct-me-order-client'; // ! For testing only
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { ICart } from '../interfaces/cart';
import { validateCartCheckoutBody, validateCreateAnonymousCartBody } from '../validators/cart.validator';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';

export class CartService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
    }

    public checkout = async (accessToken: string, id: string, body: any): Promise<any> => {
        const { error, value } = validateCartCheckoutBody(body);
        if (error) {
            throw {
                statusCode: 400,
                statusMessage: 'Validation failed',
                data: error.details.map((err) => err.message),
            };
        }

        const { shippingAddress, billingAddress, shippingMethodId, couponCodes = [], payment } = value;

        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
        // const commercetoolsMeOrderClient = new CommercetoolsMeOrderClient(accessToken); // ! For testing only

        const cart = await commercetoolsMeCartClient.getCartById(id);
        if (!cart) {
            throw {
                statusCode: 404,
                statusMessage: 'Cart not found or has expired',
            };
        }

        const profileId = cart?.id

        const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({ profileId, ctCartData: cart, couponCodes });

        const updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(profileId, customerSessionPayload);

        const talonEffects = updatedCustomerSession.effects;
        const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(talonEffects);

        const talonOneUpdateActions = this.talonOneCouponAdapter.buildCouponActions(cart, processedCouponEffects);
        // console.log('talonOneUpdateActions', talonOneUpdateActions);

        const updateActions: CartUpdateAction[] = [];

        if (shippingAddress) {
            updateActions.push({
                action: 'setShippingAddress',
                address: shippingAddress,
            });
        }

        if (billingAddress) {
            updateActions.push({
                action: 'setBillingAddress',
                address: billingAddress,
            });
        }

        if (shippingMethodId) {
            updateActions.push({
                action: 'setShippingMethod',
                shippingMethod: {
                    typeId: 'shipping-method',
                    id: shippingMethodId,
                },
            });
        }

        if (payment && (payment.source || payment.token)) {
            const paymentTransaction = {
                paymentOptionContainer: 'paymentOptions',
                paymentOptionKey: payment.key, // e.g., 'installment', 'ccw', etc.
                source: payment.source || null,
                token: payment.token || null,
                createdAt: new Date().toISOString(),
            };

            await CommercetoolsCustomObjectClient.addPaymentTransaction(cart.id, paymentTransaction);
        }

        // console.log('talonOneUpdateActions', talonOneUpdateActions)

        updateActions.push(...talonOneUpdateActions);

        const updatedCart = await CommercetoolsCartClient.updateCart(
            cart.id,
            cart.version,
            updateActions,
        );

        // const order = await commercetoolsMeOrderClient.createOrderFromCart(updatedCart); // ! For testing only

        const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(updatedCart);

        return { ...iCart, rejectedCoupons: processedCouponEffects.rejectedCoupons };
    };

    public createAnonymousCart = async (accessToken: string, body: any) => {
        const { campaignGroup, journey } = body;

        const { error } = validateCreateAnonymousCartBody({ campaignGroup, journey });
        if (error) {
            throw {
                statusCode: 400,
                statusMessage: 'Validation failed',
                data: error.details.map((err: any) => err.message),
            };
        }

        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

        const cart = await commercetoolsMeCartClient.createCart(campaignGroup, journey);

        const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(cart);

        return iCart;
    }

    public getCartById = async (accessToken: string, id: string, selectedOnly: boolean): Promise<any> => {
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
        // console.log('ctCart', ctCart);
        // console.log('ctCart.lineItems[0]', ctCart.lineItems[0]);

        const iCartWithBenefit = await commercetoolsMeCartClient.getCartWithBenefit(ctCart, selectedOnly);

        return iCartWithBenefit;
    };
}