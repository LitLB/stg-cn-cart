// cart/src/services/cart.service.ts

import _ from 'lodash'
import { Cart, CartUpdateAction, Order } from '@commercetools/platform-sdk';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { talonOneEffectConverter } from '../adapters/talon-one-effect-converter'
import { ICart } from '../interfaces/cart';
import { validateCartCheckoutBody } from '../schemas/cart.schema';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import { validateProductQuantity } from '../schemas/cart-item.schema';
import ApigeeClientAdapter from '../adapters/apigee-client.adapter';
import TsmOrderModel from '../models/tsm-order.model';
import { readConfiguration } from '../utils/config.utils';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { BlacklistService } from './blacklist.service'
import { safelyParse } from '../utils/response.utils';
import { commercetoolsOrderClient } from '../adapters/ct-order-client';
import { logger } from '../utils/logger.utils';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import { createStandardizedError } from '../utils/error.utils';
import { CreateAnonymousCartInput } from '../interfaces/create-anonymous-cart.interface';
import { IOrderAdditional, IPaymentInfo, IClientInfo } from '../interfaces/order-additional.interface';
import { HTTP_STATUSES } from '../constants/http.constant';
import { PAYMENT_STATES } from '../constants/payment.constant';
import { LOCALES } from '../constants/locale.constant';
import { cartWithFreeGift } from '../mocks/carts.mock';

export class CartService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;
    private blacklistService: BlacklistService
    private talonOneEffectConverter: typeof talonOneEffectConverter

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
        this.talonOneEffectConverter = talonOneEffectConverter
        this.blacklistService = new BlacklistService()
    }

    /**
      * Creates an anonymous cart.
      *
      * @param accessToken - The access token for authentication.
      * @param body - The validated request body containing campaignGroup and journey.
      * @returns A Promise resolving to an ICart object.
      */
    public createAnonymousCart = async (
        accessToken: string,
        createAnonymousCartInput: CreateAnonymousCartInput,
    ): Promise<ICart> => {
        try {
            const { campaignGroup, journey, locale } = createAnonymousCartInput;

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await commercetoolsMeCartClient.createCart(campaignGroup, journey, locale);

            const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(cart);

            return iCart;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'createAnonymousCart');
        }
    };

    public updateStockAllocation = async (ctCart: Cart): Promise<void> => {
        try {
            const journey = ctCart.custom?.fields?.journey as CART_JOURNEYS;
            const journeyConfig = journeyConfigMap[journey];

            for (const lineItem of ctCart.lineItems) {

                const supplyChannel = lineItem.supplyChannel;

                if (!supplyChannel || !supplyChannel.id) {
                    throw {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: 'Supply channel is missing on line item.',
                        errorCode: "SUPPLY_CHANNEL_MISSING",
                    };
                }

                const inventoryId =
                    lineItem.variant.availability?.channels?.[supplyChannel.id]?.id;

                if (!inventoryId) {
                    throw {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: 'InventoryId not found.',
                        errorCode: "INVENTORY_ID_NOT_FOUND",
                    };
                }


                const inventoryEntry = await CommercetoolsInventoryClient.getInventoryById(inventoryId);
                if (!inventoryEntry) {
                    throw {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: `Inventory entry not found for ID: ${inventoryId}`,
                        errorCode: "INVENTORY_ENTRY_NOT_FOUND",
                    };
                }

                const orderedQuantity = lineItem.quantity;
                await CommercetoolsInventoryClient.updateInventoryAllocationV2(
                    inventoryEntry,
                    orderedQuantity,
                    journey,
                    journeyConfig
                );
            }
        } catch (error: any) {
            console.log('error', error)
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Update stock allocation failed.`,
                errorCode: "CREATE_ORDER_ON_CT_FAILED",
            };
        }
    };

    // TODO :: CART HAS CHANGED
    public createOrder = async (accessToken: any, payload: any, partailValidateList: any[] = []): Promise<any> => {
        try {

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
            const defaultValidateList = [
                'BLACKLIST',
                'CAMPAIGN',
            ]

            let validateList = defaultValidateList
            if (partailValidateList.length) {
                validateList = partailValidateList
            }

            const { cartId, client } = payload
            const ctCart = await this.getCtCartById(accessToken, cartId)

            // * STEP #2 - Validate Blacklist
            if (validateList.includes('BLACKLIST')) {
                await this.validateBlacklist(ctCart, client)
            }

            // * STEP #3 - Validate Campaign & Promotion Set
            if (validateList.includes('CAMPAIGN')) {
                await this.validateCampaign(ctCart)
            }

            // * STEP #4 - Validate Available Quantity (Commercetools)
            await this.validateAvailableQuantity(ctCart)

            const orderNumber = this.generateOrderNumber()

            // * STEP #5 - Create Order On TSM Sale
            const { success, response } = await this.createTSMSaleOrder(orderNumber, ctCart)
            // //! IF available > x
            // //! THEN continue
            // //! ELSE 
            // //! THEN throw error

            const tsmSaveOrder = {
                tsmOrderIsSaved: success,
                tsmOrderResponse: typeof response === 'string' ? response : JSON.stringify(response)
            }
            // return tsmSaveOrder

            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(ctCart)
            const cartWithUpdatedPrice = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)

            await this.updateStockAllocation(cartWithUpdatedPrice);
            const order = await commercetoolsOrderClient.createOrderFromCart(orderNumber, cartWithUpdatedPrice, tsmSaveOrder);
            await this.createOrderAdditional(order, client);
            return {...order,hasChanged: cartWithUpdatedPrice.compared};
        } catch (error: any) {
            logger.info(`CartService.createOrder.error`, error);
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'createOrder');
        }
    };

    // TODO :: CART HAS CHANGED
    public checkout = async (accessToken: string, id: string, body: any): Promise<any> => {
        try {
            const { error, value } = validateCartCheckoutBody(body);
            if (error) {
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const { shippingAddress, billingAddress, shippingMethodId, payment } = value;

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await commercetoolsMeCartClient.getCartById(id);
            if (!cart) {
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'Cart not found or has expired',
                };
            }

            const profileId = cart?.id
            let coupons;
            try {
                coupons = await this.talonOneCouponAdapter.getEffectsCouponsById(profileId, cart.lineItems);
            } catch (error: any) {
                logger.info(`CartService.checkout.getEffectsCouponsById.error`, error);
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    errorCode: "CART_GET_EFFECTS_COUPONS_CT_FAILED",
                    statusMessage: 'No discount coupon effect found.',
                };
            }

            const updateActions: CartUpdateAction[] = [];
            try {
                const dataRetchCoupon = await this.talonOneCouponAdapter.fetchEffectsCouponsById(profileId, cart, coupons.coupons);
                coupons.coupons = dataRetchCoupon.couponsEffects;
                if (coupons.coupons.rejectedCoupons && coupons.coupons.rejectedCoupons.length > 0) {
                    throw {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        errorCode: "COUPON_VALIDATION_FAILED",
                        statusMessage: 'Some coupons were rejected during processing.',
                        data: coupons.coupons.rejectedCoupons,
                    };
                }
                if (dataRetchCoupon.talonOneUpdateActions) {
                    updateActions.push(...dataRetchCoupon.talonOneUpdateActions);
                }
            } catch (error: any) {
                logger.info(`CartService.checkout.fetchEffectsCouponsById.error`, error);
                if (error.errorCode && error.statusMessage) {
                    throw error;
                }
                
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    errorCode: "CART_FETCH_EFFECTS_COUPONS_CT_FAILED",
                    statusMessage: 'An unexpected error occurred while processing the coupon effects.',
                };
            }

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

            if (payment && payment?.key) {
                const paymentTransaction = {
                    paymentOptionContainer: 'paymentOptions',
                    paymentOptionKey: payment.key, // e.g., 'installment', 'ccw', etc.
                    source: payment?.source || null,
                    token: payment?.token || null,
                    additionalData: payment?.additionalData || null,
                    createdAt: new Date().toISOString(),
                };

                await CommercetoolsCustomObjectClient.addPaymentTransaction(cart.id, paymentTransaction);
            }

            // console.log('talonOneUpdateActions', talonOneUpdateActions)

            // updateActions.push(...talonOneUpdateActions);

            const updatedCart = await CommercetoolsCartClient.updateCart(
                cart.id,
                cart.version,
                updateActions,
            );

            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(updatedCart)
            const cartWithUpdatedPrice = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)

            const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(cartWithUpdatedPrice);

            return { ...iCart, ...coupons, hasChanged: cartWithUpdatedPrice.compared };
        } catch (error: any) {
            logger.info(`CartService.checkout.error`, error);
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'checkout');
        }
    };


    // TODO :: CART HAS CHANGED
    public getCartById = async (accessToken: string, id: string, selectedOnly: boolean): Promise<ICart> => {
        try {
            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const ctCart = await commercetoolsMeCartClient.getCartById(id);
            if (!ctCart) {
                throw createStandardizedError({ statusCode: HTTP_STATUSES.BAD_REQUEST, statusMessage: 'Cart not found or has expired' });
            }

            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(ctCart)
            const cartWithUpdatedPrice = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)

            const iCartWithBenefit = await commercetoolsMeCartClient.getCartWithBenefit(cartWithUpdatedPrice, selectedOnly);

            let coupons;
            try {
                coupons = await this.talonOneCouponAdapter.getEffectsCouponsById(id, cartWithUpdatedPrice.lineItems);
            } catch (error: any) {
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    errorCode: "CART_GET_EFFECTS_COUPONS_CT_FAILED",
                    statusMessage: 'No discount coupon effect found.',
                };
            }



            return { ...iCartWithBenefit, ...coupons, hasChanged: cartWithUpdatedPrice.compared };
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'getCartById');
        }
    };

    
    public getCtCartById = async (accessToken: string, id: string): Promise<any> => {
        try {
            if (!id) {
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Cart ID is required',
                };
            }

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const ctCart = await commercetoolsMeCartClient.getCartById(id);
            if (!ctCart) {
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'Cart not found or has expired',
                };
            }

            return ctCart
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'getCtCartById');
        }
    };

    // TODO: final step
    private createTSMSaleOrder = async (orderNumber: string, cart: any) => {
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter
            const config = readConfiguration()
            console.log('JSON.stringify(cart)', JSON.stringify(cart));
            const tsmOrder = new TsmOrderModel({ ctCart: cartWithFreeGift, config, orderNumber })
            const tsmOrderPayload = tsmOrder.toPayload()
            console.log('JSON.stringify(tsmOrderPayload)', JSON.stringify(tsmOrderPayload));

            logger.info(`tsmOrderPayload: ${JSON.stringify(tsmOrderPayload)}`)
            const response = await apigeeClientAdapter.saveOrderOnline(tsmOrderPayload)
            // const response = { code: '0'}
            const { code } = response || {}

            // if (code !== '0') {
            //     throw {
            //         statusCode: HTTP_STATUSES.BAD_REQUEST,
            //         statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
            //         errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED'
            //     };
            // }

            // console.log(JSON.parse("{\"benefitType\":\"add_on\",\"campaignCode\":\"\",\"promotionSetCode\":\"MOCK007\",\"promotionSetProposition\":\"886\",\"group\":\"add_on_1\",\"discountBaht\":0,\"discountPercent\":0,\"specialPrice\":79000,\"isForcePromotion\":false}"))
            // {
            //     benefitType: 'add_on',
            //     campaignCode: '',
            //     promotionSetCode: 'MOCK007',
            //     promotionSetProposition: '886',
            //     group: 'add_on_1',
            //     discountBaht: 0,
            //     discountPercent: 0,
            //     specialPrice: 79000,
            //     isForcePromotion: false
            // }

            // Double Stringify
            // console.log(JSON.stringify(JSON.stringify({
            //     "benefitType": "free_gift",
            //     "campaignCode": "",
            //     "promotionSetCode": "UI034",
            //     "promotionSetProposition": "999",
            //     "group": "free_gift_1",
            //     "discountBaht": 0,
            //     "discountPercent": 0,
            //     "specialPrice": 79000,
            //     "isForcePromotion": false
            // }
            // )));
            console.log(JSON.parse("{\"benefitType\":\"free_gift\",\"campaignCode\":\"\",\"promotionSetCode\":\"UI034\",\"promotionSetProposition\":\"999\",\"group\":\"free_gift_1\",\"discountBaht\":0,\"discountPercent\":0,\"specialPrice\":79000,\"isForcePromotion\":false}"));
            // {
            //   benefitType: 'free_gift',
            //   campaignCode: '',
            //   promotionSetCode: 'UI034',
            //   promotionSetProposition: '999',
            //   group: 'free_gift_1',
            //   discountBaht: 0,
            //   discountPercent: 0,
            //   specialPrice: 79000,
            //   isForcePromotion: false
            // }

            return {
                success: code === '0',
                response
            }

        } catch (error: any) {
            logger.info(`createTSMSaleOrder-error: ${JSON.stringify(error)}`)
            let data = error?.response?.data
            if (data) {
                data = safelyParse(data)
            }
            // throw {
            //     statusCode: HTTP_STATUSES.BAD_REQUEST,
            //     statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
            //     errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED',
            //     ...(data ? { data } : {})
            // };
            return {
                success: false,
                response: data
            }
        }
    }

    private async validateBlacklist(ctCart: any, client: any) {
        try {
            const { custom: cartCustomField, shippingAddress } = ctCart
            const journey = cartCustomField?.fields?.journey
            const { googleId, ip } = client || {}

            const paymentTransaction = await CommercetoolsCustomObjectClient.getPaymentTransaction(ctCart.id);
            const paymentTransactions = paymentTransaction?.value || []
            const latestPaymentTransaction = paymentTransactions.at(-1)
            const {
                paymentOptionKey,
                additionalData
            } = latestPaymentTransaction || {}

            const {
                firstDigits,
                lastDigits,
                phoneNumber,
            } = additionalData || {}

            let paymentTMNAccountNumber = null
            let paymentCreditCardNumber = {
                firstDigits: null,
                lastDigits: null
            }

            if (['truemoney'].includes(paymentOptionKey)) {
                paymentTMNAccountNumber = phoneNumber
            }

            if (['ccw', 'installment'].includes(paymentOptionKey)) {
                paymentCreditCardNumber = {
                    firstDigits,
                    lastDigits
                }
            }

            const body: any =
            {
                journey, /* Mandarory */
                ...(['truemoney'].includes(paymentOptionKey) ? { paymentTMNAccountNumber } : {  }),
                // ...(['ccw', 'installment'].includes(paymentOptionKey) ? { paymentCreditCardNumber } : {  }),
                ...(ip ? { ipAddress: ip } : {  }),
                ...(googleId ? { googleID: googleId } : {  }),
                shippingAddress: {
                    city: shippingAddress.state, /* Mandarory */
                    district: shippingAddress.city, /* Mandarory */
                    postcode: shippingAddress.postalCode, /* Mandarory */
                    subDistrict: shippingAddress.custom?.fields?.subDistrict /* Mandarory */
                },
                email: shippingAddress.email, /* Mandarory */
                deliveryContactNumber: shippingAddress.phone, /* Mandarory */
                deliveryContactName: `${shippingAddress.firstName} ${shippingAddress.lastName}` /* Mandarory */
            }

            logger.info(`CartService-validateBlacklist-body: ${JSON.stringify(body)}`)
            const response = await this.blacklistService.checkBlacklist(body);
            if (!response?.status) {
                throw new Error('Blacklist validation failed');
            }
        } catch (e) {
            logger.info(`CartService-validateBlacklist-error: ${JSON.stringify(e)}`)
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'BLACKLIST_VALIDATE_FAILED'
            };
        }
    }


    private validateMandatoryProduct(selectedLineItems: any[], selectedlineItemWithCampaignBenefits: any[]) {
        const mainProductLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'main_product')
        for (const mainProductLineItem of mainProductLineItems) {
            const sku = mainProductLineItem.variant.sku;
            const productType = mainProductLineItem?.custom?.fields?.productType;
            const productGroup = mainProductLineItem?.custom?.fields?.productGroup;

            let privilege = mainProductLineItem?.custom?.fields?.privilege;
            privilege = privilege ? JSON.parse(privilege) : null;

            const selectedlineItemWithCampaignBenefit = selectedlineItemWithCampaignBenefits.find((item: any) => {
                return item.variant.sku === sku &&
                    item.custom.fields.productType === productType &&
                    item.custom.fields.productGroup === productGroup
            })

            const { privilege: newPrivilege } = selectedlineItemWithCampaignBenefit

            if (!_.isEqual(privilege, newPrivilege)) {
                throw new Error('Invalid main product');
            }
        }



        return true;
    }

    private validateSecondaryProduct(selectedLineItems: any[], selectedlineItemWithCampaignBenefits: any[]) {
        const mainProductLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'main_product')

        const addOnLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'add_on')

        let validateObject = mainProductLineItems.reduce((acc: any, mainProductLineItem: any) => {
            const sku = mainProductLineItem.variant.sku
            const productType = mainProductLineItem?.custom?.fields?.productType
            const productGroup = mainProductLineItem?.custom?.fields?.productGroup

            const selectedlineItemWithCampaignBenefit = selectedlineItemWithCampaignBenefits.find((item: any) => {
                return item.variant.sku === sku &&
                    item.custom.fields.productType === productType &&
                    item.custom.fields.productGroup === productGroup
            })

            const { availableBenefits } = selectedlineItemWithCampaignBenefit
            const groupMap = availableBenefits?.reduce(((acc: any, availableBenefit: any) => {
                const { promotionSetCode, maxReceive, group, maxItem } = availableBenefit
                if (!acc?.[promotionSetCode]) {
                    acc[promotionSetCode] = {
                        remainingMaxReceive: maxReceive,
                        remainingMaxItem: {}
                    }
                }

                acc[promotionSetCode].remainingMaxItem = {
                    ...acc[promotionSetCode].remainingMaxItem,
                    [group]: maxItem
                }

                return acc
            }), {})

            //! {
            //!     1: {
            //!         xx1234: {
            //!             remainingMaxReceive: 5,
            //!             remainingMaxItem: {
            //!                 addon1: 2,
            //!                 addon2: 2
            //!             }
            //!         }
            //!     }
            //! }
            acc[productGroup] = groupMap

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

            const groupMap = acc[productGroup]

            if (!groupMap) {
                throw new Error('Invalid add-on product');
            }

            const { promotionSetCode } = privilege
            const limit = groupMap[promotionSetCode]

            if (!limit) {
                throw new Error('Invalid add-on product');
            }

            const { remainingMaxReceive, remainingMaxItem } = limit

            if (!remainingMaxItem[addOnGroup]) {
                throw new Error('Invalid add-on product');

            }

            acc[productGroup][promotionSetCode] = {
                remainingMaxReceive: remainingMaxReceive - quantity,
                remainingMaxItem: {
                    ...remainingMaxItem,
                    [addOnGroup]: remainingMaxItem[addOnGroup] - quantity
                }
            }

            return acc;
        }, validateObject);

        //! {
        //!     1: {
        //!         xx1234: {
        //!             remainingMaxReceive: 5,
        //!             remainingMaxItem: {
        //!                 addon1: 2,
        //!                 addon2: 2
        //!             }
        //!         }
        //!     }
        //! }
        // Loop through the product groups
        Object.entries(validateObject as Record<string, any>).forEach(([productGroup, groupLimits]) => {
            // Loop through the next level (e.g., xx1234)
            Object.entries(groupLimits as Record<string, any>).forEach(([levelKey, limits]) => {
                const { remainingMaxReceive, remainingMaxItem } = limits;

                // Check the remainingMaxReceive for this level
                if (remainingMaxReceive < 0) {
                    throw new Error(`Total add-on reach limit for product group "${productGroup}"`);
                }

                // Check remainingMaxItem for this level
                Object.entries(remainingMaxItem as Record<string, any>).forEach(([addOnGroup, maxItem]) => {
                    if (maxItem < 0) {
                        throw new Error(
                            `Total add-on group "${addOnGroup}" reach limit for level "${levelKey}" in product group "${productGroup}"`
                        );
                    }
                });
            });
        });

        return true;
    }

    private async validateCampaign(ctCart: any) {
        try {
            const { lineItems } = ctCart;
            const lineItemWithCampaignBenefits = await talonOneEffectConverter.getCtLineItemWithCampaignBenefits(ctCart)
            // const selectedlineItemWithCampaignBenefits = lineItemWithCampaignBenefits.filter((lineItemWithCampaignBenefit: any) => lineItemWithCampaignBenefit.custom?.fields?.selected)
            // const selectedLineItems = lineItems.filter((lineItem: any) => lineItem.custom?.fields?.selected)
            const selectedlineItemWithCampaignBenefits = lineItemWithCampaignBenefits
            const selectedLineItems = lineItems

            this.validateMandatoryProduct(selectedLineItems, selectedlineItemWithCampaignBenefits)
            this.validateSecondaryProduct(selectedLineItems, selectedlineItemWithCampaignBenefits);

            return true;
        } catch (error: any) {
            console.error('error-cartService-validateCampaign', error)
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: error?.statusMessage || error.message || EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CAMPAIGN_VALIDATE_FAILED'
            };
        }
    }

    private async validateAvailableQuantity(ctCart: Cart) {
        try {
            const { lineItems } = ctCart
            for (const lineItem of lineItems) {
                const productType = lineItem.custom?.fields?.productType;
                const sku = lineItem.variant.sku as string;
                const productId = lineItem.productId;

                const product = await CommercetoolsProductClient.getProductById(productId);
                if (!product) {
                    throw {
                        statusCode: HTTP_STATUSES.NOT_FOUND,
                        statusMessage: 'Product not found',
                    };
                }

                const variant = CommercetoolsProductClient.findVariantBySku(product, sku);
                if (!variant) {
                    throw {
                        statusCode: HTTP_STATUSES.NOT_FOUND,
                        statusMessage: 'SKU not found in the specified product',
                    };
                }

                const inventories = await CommercetoolsInventoryClient.getInventory(sku);
                if (inventories.length === 0) {
                    throw {
                        statusCode: HTTP_STATUSES.NOT_FOUND,
                        statusMessage: 'Inventory not found',
                    };
                }
                const inventory = inventories[0];
                if (inventory.isOutOfStock) {
                    throw {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: 'Insufficient stock for the requested quantity',
                    };
                }

                validateProductQuantity(
                    productType,
                    ctCart,
                    sku,
                    productId,
                    variant,
                )
            }
            return true
        } catch (error: any) {
            console.error(error)
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: error?.statusMessage || error.message || EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED'
            };
        }
    }


    private generateOrderNumber() {
        const timestamp = Date.now().toString(); // Current timestamp
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // Random 4-digit number
        return `ORD-${timestamp}-${random}`; // Combine parts into an order number
    }

    public createOrderAdditional = async (
        order: Order,
        client: IClientInfo,
    ) => {

        const paymentInfo: IPaymentInfo = {
            tmhAccountNumber: '',
            bankAccount: '',
            bankAccountName: '',
            creditCardNumber: '',
            created: new Date().toISOString(),
            paymentState: PAYMENT_STATES.PENDING,
        }

        const orderAdditionalData: IOrderAdditional = {
            orderInfo: { journey: _.get(order, 'custom.fields.journey') },
            paymentInfo: [paymentInfo],
            customerInfo: {
                ipAddress: _.get(client, 'ip', ''),
                googleID: _.get(client, 'googleId', '')
            },
        }

        await CommercetoolsCustomObjectClient.addOrderAdditional(order.id, orderAdditionalData);

        return true;
    };
}