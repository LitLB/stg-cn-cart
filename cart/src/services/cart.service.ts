// cart/src/services/cart.service.ts

import { CartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import CommercetoolsMeOrderClient from '../adapters/me/ct-me-order-client'; // ! For testing only
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { talonOneEffectConverter } from '../adapters/talon-one-effect-converter'
import { ICart } from '../interfaces/cart';
import { validateCartCheckoutBody, validateCreateAnonymousCartBody } from '../validators/cart.validator';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import { CtT1Adapter } from '../adapters/ct-t1.adapter';
import { validateProductQuantity } from '../validators/cart-item.validator';
import ApigeeClientAdapter from '../adapters/apigee-client.adapter';
import TsmOrderModel from '../models/tsm-order.model';
import { readConfiguration } from '../utils/config.utils';

import { EXCEPTION_MESSAGES } from '../utils/messages.utils';
import { BlacklistService } from './blacklist.service'
export class CartService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;
    private ctT1Adapter: CtT1Adapter;
    private blacklistService: BlacklistService
    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
        this.ctT1Adapter = new CtT1Adapter();
        this.blacklistService = new BlacklistService()
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
        // return ctCart
        // console.log('ctCart', ctCart);
        // console.log('ctCart.lineItems[0]', ctCart.lineItems[0]);

        const iCartWithBenefit = await commercetoolsMeCartClient.getCartWithBenefit(ctCart, selectedOnly);

        return iCartWithBenefit;
    };

    public createOrder = async (accessToken: any, payload: any, partailValidateList: any[] = []): Promise<any> => {

        const defaultValidateList = [
            'BLACKLIST',
            'CAMPAIGN',
        ]

        let validateList = defaultValidateList
        if (partailValidateList.length) {
            validateList = partailValidateList
        }

        const { cartId } = payload
        const ctCart = await this.getCtCartById(accessToken, cartId)
        // TODO: STEP #2 - Validate Blacklist
        if (validateList.includes('BLACKLIST')) {
            await this.validateBlacklist(ctCart)
        }

        // TODO: STEP #3 - Validate Campaign & Promotion Set
        if (validateList.includes('BLACKLIST')) {
            await this.validateCampaign(ctCart)
        }

        // TODO: STEP #4 - Validate Available Quantity (Commercetools)
        await this.validateAvailableQuantity(ctCart)

        // TODO: STEP #5 - Create Order On TSM Sale
        await this.createTSMSaleOrder(ctCart)
        // TODO: STEP #6 - Create Order On Commercetools
        const commercetoolsMeOrderClient = new CommercetoolsMeOrderClient(accessToken)
        const order = await commercetoolsMeOrderClient.createOrderFromCart(ctCart); // ! For testing only

        return order
    };

    public getCtCartById = async (accessToken: string, id: string): Promise<any> => {
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

        return ctCart
    };

    private createTSMSaleOrder = async (cart: any) => {
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter
            const config = readConfiguration()
            const tsmOrder = new TsmOrderModel({ ctCart: cart, config })
            const tsmOrderPayload = tsmOrder.toPayload()
            const response = await apigeeClientAdapter.saveOrderOnline(tsmOrderPayload)

            const { code } = response || {}

            if (code !== '0') {
                throw {
                    statusCode: 400,
                    statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
                    errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED',
                    data: response
                };
            }
        } catch (error: any) {
            console.error('error-cartService-createTSMSaleOrder', error)
            throw {
                statusCode: 400,
                statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED',
                data: error?.data || null
            };
        }
    }

    private async validateBlacklist(ctCart: any) {
        try {
            return true
            const body: any =
            {
                "journey": "device_only", /* Mandarory */
                "paymentTMNAccountNumber": "0830053853",
                "paymentCreditCardNumber": {
                    "firstDigits": null,
                    "lastDigits": "1234"
                },
                "ipAddress": "127.0.0.1",
                "googleID": "thiamkhae.pap@ascendcorp.com",
                "shippingAddress": {
                    "city": "Bangkok", /* Mandarory */
                    "district": "Donmuang", /* Mandarory */
                    "postcode": "10210", /* Mandarory */
                    "subDistrict": "Donmuang" /* Mandarory */
                },
                "email": "thiamkhae.pap@ascendcorp.com", /* Mandarory */
                "deliveryContactNumber": "0830053853", /* Mandarory */
                "deliveryContactName": "เทียมแข ปภานันท์กุล" /* Mandarory */
            }
            const response = await this.blacklistService.checkBlacklist(body);

            if (!response?.status) {
                throw new Error('Blacklist validation failed');
            }
        } catch (e) {
            throw {
                statusCode: 400,
                statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'BLACKLIST_VALIDATE_FAILED'
            };
        }
    }


    private validateMandatoryProduct() {
        return true
    }

    private validateSecondaryProduct(selectedLineItems: any[], cartItems: any[], convertedEffects: any) {
        const mapEffectToLineItem = selectedLineItems
            .filter((selectedLineItem: any) => selectedLineItem.custom?.fields?.productType === 'main_product')
            .reduce((acc: any, selectedLineItem: any) => {
                const productType = selectedLineItem?.custom?.fields?.productType
                const productGroup = selectedLineItem?.custom?.fields?.productGroup

                const selectedCartItem = cartItems?.find((cartItem: any) => cartItem?.attributes?.product_type === productType && cartItem?.attributes?.product_group === productGroup);

                if (!acc?.[selectedLineItem.id]) {
                    acc[selectedLineItem.id] = [];
                }

                const effects = convertedEffects.filter((convertedEffect: any) => convertedEffect.cartItemPosition === selectedCartItem.position)

                acc[selectedLineItem.id] = [
                    ...acc[selectedLineItem.id],
                    ...effects,
                ];

                return acc;
            }, {});

        const mainProductLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'main_product')

        const addOnLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'add_on')

        let validateObject = mainProductLineItems.reduce((acc: any, lineItem: any) => {
            const lineItemId = lineItem.id
            const LineItemEffects = mapEffectToLineItem?.[lineItemId] || []
            const productGroup = lineItem?.custom?.fields?.productGroup;

            const LineItemEffect = LineItemEffects.find(() => true);
            const promotionSet = LineItemEffect?.promotionSet
            const remainingMaxReceive = promotionSet?.tsm_promotion_set__max_receive || 0;

            const promotionDetails = LineItemEffect?.productPromotionDetails

            const remainingMaxItem = promotionDetails?.reduce((acc: any, promotionDetail: any) => {
                const group = promotionDetail.detail.tsm_promotion_detail__group_code
                const maxItem = promotionDetail.detail.tsm_promotion_detail__max_items
                acc[group] = maxItem;
                return acc
            }, {})

            acc[productGroup] = {
                remainingMaxReceive,
                remainingMaxItem,
            }
            return acc
        }, {});

        validateObject = addOnLineItems.reduce((acc: any, addOnLineItem: any) => {
            const quantity = addOnLineItem.quantity;
            const productGroup = addOnLineItem?.custom?.fields?.productGroup;
            const addOnGroup = addOnLineItem?.custom?.fields?.addOnGroup;
            let privilege = addOnLineItem?.custom?.fields?.privilege;
            privilege = privilege ? JSON.parse(privilege) : null;

            if (!privilege) {
                throw new Error('Invalid add-on product');
            }

            const { remainingMaxReceive, remainingMaxItem } = acc[productGroup]
            acc[productGroup] = {
                remainingMaxReceive: remainingMaxReceive - quantity,
                remainingMaxItem: {
                    ...remainingMaxItem,
                    [addOnGroup]: remainingMaxItem[addOnGroup] - quantity
                }
            }

            return acc;
        }, validateObject);

        Object.entries(validateObject as Record<string, any>).forEach(([productGroup, limit]) => {
            const { remainingMaxReceive, remainingMaxItem } = limit
            if (remainingMaxReceive < 0) {
                throw new Error(`Total add-on reach limit for product group "${productGroup}"`);
            }

            Object.entries(remainingMaxItem as Record<string, number>).forEach(([addOnGroup, maxItem]) => {
                if (maxItem < 0) {
                    throw new Error(`Total add-on group "${addOnGroup}" reach limit for product group "${productGroup}"`);
                }
            });
        });

        return true;
    }

    private async validateCampaign(ctCart: any) {
        try {
            const { id: cartId, lineItems } = ctCart;
            const customerSessionWithConvertedEffects: any = await talonOneEffectConverter.getCustomerSessionWithConvertedEffectsById(cartId);

            const { effects, cartItems } = customerSessionWithConvertedEffects.customerSession;

            const selectedLineItems = lineItems.filter((lineItem: any) => lineItem.custom?.fields?.selected)

            this.validateMandatoryProduct()
            this.validateSecondaryProduct(selectedLineItems, cartItems, effects);

            return true;
        } catch (e) {
            throw {
                statusCode: 400,
                statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CAMPAIGN_VALIDATE_FAILED'
            };
        }
    }

    private validateAvailableQuantity(ctCart: any) {
        try {
            const { lineItems } = ctCart

            lineItems
                .filter((lineItem: any) => lineItem?.custom?.fields?.selected)
                .forEach((lineItem: any) => {
                    const productType = lineItem.custom?.fields?.productType
                    const sku = lineItem.variant.sku
                    const productId = lineItem.productId
                    const variant = lineItem.variant
                    const quantity = lineItem.quantity

                    validateProductQuantity(
                        productType,
                        ctCart,
                        sku,
                        productId,
                        variant,
                        quantity,
                    )
                })

            return true
        } catch (e) {
            throw {
                statusCode: 400,
                statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED'
            };
        }
    }
}