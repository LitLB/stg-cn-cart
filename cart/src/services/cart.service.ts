// cart/src/services/cart.service.ts

import { CartUpdateAction, MyCartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import CommercetoolsMeOrderClient from '../adapters/me/ct-me-order-client'; // ! For testing only
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { ICart } from '../interfaces/cart';
import { validateCartCheckoutBody, validateCreateAnonymousCartBody } from '../validators/cart.validator';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { CtT1Adapter } from '../adapters/ct-t1.adapter';

export class CartService {
    private ctT1Adapter: CtT1Adapter;

    constructor() {
        this.ctT1Adapter = new CtT1Adapter();
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
        // console.log('value', value);
        // console.log('couponCodes', couponCodes);

        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
        const commercetoolsMeOrderClient = new CommercetoolsMeOrderClient(accessToken); // ! For testing only

        const cart = await commercetoolsMeCartClient.getCartById(id);
        if (!cart) {
            throw {
                statusCode: 404,
                statusMessage: 'Cart not found or has expired',
            };
        }
        // console.log('cart.custom', cart.custom);

        const profileId = cart?.id
        const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({ profileId, ctCartData: cart, couponCodes });
        // console.log('customerSessionPayload', customerSessionPayload);
        // console.log('JSON.stringify(customerSessionPayload,null,2)', JSON.stringify(customerSessionPayload, null, 2));
        const customerSession = await talonOneIntegrationAdapter.updateCustomerSession(profileId, customerSessionPayload, { dry: true });
        // console.log('customerSession', customerSession);
        // console.log('customerSession.effects', customerSession.effects);

        const talonEffects = customerSession.effects;
        const talonOneUpdateActions = this.ctT1Adapter.handleEffectsV5(
            talonEffects,
            cart
        );
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

        updateActions.push(...talonOneUpdateActions);

        console.log('updateActions', updateActions);

        const updatedCart = await CommercetoolsCartClient.updateCart(
            cart.id,
            cart.version,
            updateActions,
        );

        const order = await commercetoolsMeOrderClient.createOrderFromCart(updatedCart); // ! For testing only

        const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(updatedCart);

        return iCart;
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

// updateCart.error BadRequest: Unknown field 'lineItemId'.
//     at createError (C:\Users\devvi\OneDrive\Desktop\opt\ascend-group\cn-cart\cart\node_modules\@commercetools\sdk-middleware-http\dist\sdk-middleware-http.cjs.js:241:29)
//     at C:\Users\devvi\OneDrive\Desktop\opt\ascend-group\cn-cart\cart\node_modules\@commercetools\sdk-middleware-http\dist\sdk-middleware-http.cjs.js:438:25
//     at process.processTicksAndRejections (node:internal/process/task_queues:95:5) {
//   code: 400,
//   statusCode: 400,
//   status: 400,
//   originalRequest: {
//     baseUri: 'https://api.europe-west1.gcp.commercetools.com',
//     method: 'POST',
//     uriTemplate: '/{projectKey}/carts/{ID}',
//     pathVariables: {
//       projectKey: 'truecorp_omni_platform_dev',
//       ID: '1080cdef-f7af-4a47-9278-1c403ac2c6a0'
//     },
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: 'Bearer ********'
//     },
//     queryParams: undefined,
//     body: { version: 6, actions: [Array] },
//     uri: '/truecorp_omni_platform_dev/carts/1080cdef-f7af-4a47-9278-1c403ac2c6a0'
//   },
//   retryCount: 0,
//   headers: {
//     'access-control-allow-headers': 'Accept, Authorization, Content-Type, Origin, User-Agent, X-Correlation-ID',
//     'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
//     'access-control-allow-origin': '*',
//     'access-control-expose-headers': 'X-Correlation-ID',
//     'access-control-max-age': '299',
//     'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
//     'content-encoding': 'gzip',
//     'content-type': 'application/json; charset=utf-8',
//     date: 'Tue, 26 Nov 2024 09:46:42 GMT',
//     server: 'istio-envoy',
//     'server-timing': 'projects;dur=76',
//     'transfer-encoding': 'chunked',
//     via: '1.1 google',
//     'x-correlation-id': 'projects-d80b3ece-b5f7-4115-9099-721cc582e2a2',
//     'x-envoy-upstream-service-time': '77',
//     'x-http-status-caused-by-external-upstream': 'false'
//   },
//   body: {
//     statusCode: 400,
//     message: "Unknown field 'lineItemId'.",
//     errors: [ [Object], [Object], [Object], [Object], [Object], [Object] ]
//   }
// }