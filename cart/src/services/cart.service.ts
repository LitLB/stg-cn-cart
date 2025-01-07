// cart/src/services/cart.service.ts

import _ from 'lodash'
import { Cart, CartUpdateAction, LineItem, Order } from '@commercetools/platform-sdk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

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
import { logger } from '../utils/logger.utils';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import { createStandardizedError } from '../utils/error.utils';
import { CreateAnonymousCartInput } from '../interfaces/create-anonymous-cart.interface';
import { IOrderAdditional, IPaymentInfo, IClientInfo } from '../interfaces/order-additional.interface';
import { HTTP_STATUSES } from '../constants/http.constant';
import { PAYMENT_STATES } from '../constants/payment.constant';
import { commercetoolsOrderClient } from '../adapters/ct-order-client';
import { CouponService } from './coupon.service';
import { Coupon, ICoupon } from '../interfaces/coupon.interface';
import { CartValidator } from '../validators/cart.validator';
import { COUPON_INFO_CONTAINER } from '../constants/ct.constant';
export class CartService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;
    private blacklistService: BlacklistService;
    private couponService: CouponService;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
        this.blacklistService = new BlacklistService()
        this.couponService = new CouponService()
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

    private async removeUnselectedItems(ctCart: Cart): Promise<Cart> {
        try {
            const unselectedLineItems = ctCart.lineItems.filter(
                (li: LineItem) => li.custom?.fields?.selected !== true
            );

            if (!unselectedLineItems.length) {
                return ctCart;
            }

            const removeActions: CartUpdateAction[] = unselectedLineItems.map((lineItem: LineItem) => ({
                action: 'removeLineItem',
                lineItemId: lineItem.id,
            }));

            const updatedCart = await CommercetoolsCartClient.updateCart(
                ctCart.id,
                ctCart.version,
                removeActions
            );

            return updatedCart;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(
                {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Some coupons were rejected during processing.',
                },
                'removeUnselectedItems'
            );
        }
    }

    public createOrder = async (accessToken: any, payload: any, partailValidateList: any[] = []): Promise<any> => {
        try {
            const { cartId, client } = payload;
            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
            const defaultValidateList = [
                'BLACKLIST',
                'CAMPAIGN',
            ]

            let validateList = defaultValidateList
            if (partailValidateList.length) {
                validateList = partailValidateList
            }

            let ctCart = await this.getCtCartById(accessToken, cartId)

            CartValidator.validateCartHasSelectedItems(ctCart);

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

            ctCart = await this.handleAutoRemoveCoupons(ctCart, cartId);

            ctCart = await this.removeUnselectedItems(ctCart);

            const orderNumber = await this.generateOrderNumber(`TRUE`)

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

            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(ctCart)
            const cartWithUpdatedPrice = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)

            await this.updateStockAllocation(cartWithUpdatedPrice);
            const order = await commercetoolsOrderClient.createOrderFromCart(orderNumber, cartWithUpdatedPrice, tsmSaveOrder);
            await this.createOrderAdditional(order, client);
            return { ...order, hasChanged: cartWithUpdatedPrice.compared };
        } catch (error: any) {
            logger.error(`CartService.createOrder.error`, error);
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'createOrder');
        }
    };

    private async handleAutoRemoveCoupons(ctCart: Cart, cartId: string): Promise<Cart> {
        // 1. Auto-remove invalid coupons
        const { updatedCart, permanentlyInvalidRejectedCoupons } =
            await this.couponService.autoRemoveInvalidCouponsAndReturnOnce(ctCart);
        ctCart = updatedCart;
        if (permanentlyInvalidRejectedCoupons.length > 0) {
            throw createStandardizedError(
                {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Some coupons were rejected during processing.',
                    data: permanentlyInvalidRejectedCoupons,
                },
                'handleAutoRemoveCoupons'
            );
        }

        // 2. Grab coupon data
        const couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCartId(
            ctCart.id,
            ctCart.lineItems
        );

        // 3. Construct updateActions from coupon effects
        const updateActions: CartUpdateAction[] = [];
        const { couponsEffects, talonOneUpdateActions } =
            await this.talonOneCouponAdapter.fetchCouponEffectsAndUpdateActionsById(
                ctCart.id,
                ctCart,
                couponEffects.coupons
            );

        if (talonOneUpdateActions?.updateActions) {
            updateActions.push(...talonOneUpdateActions.updateActions);
        }

        // 4. Possibly add coupon info
        await this.couponService.addCouponInformation(
            updateActions,
            cartId,
            talonOneUpdateActions?.couponsInformation
        );

        // 5. Apply any updates
        if (updateActions.length > 0) {
            return await CommercetoolsCartClient.updateCart(ctCart.id, ctCart.version, updateActions);
        }

        return ctCart;
    }

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

            const ctCart = await commercetoolsMeCartClient.getCartById(id);
            if (!ctCart) {
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'Cart not found or has expired',
                };
            }

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

            if (payment && payment?.key) {
                const paymentTransaction = {
                    paymentOptionContainer: 'paymentOptions',
                    paymentOptionKey: payment.key, // e.g., 'installment', 'ccw', etc.
                    source: payment?.source || null,
                    token: payment?.token || null,
                    additionalData: payment?.additionalData || null,
                    createdAt: new Date().toISOString(),
                };

                await CommercetoolsCustomObjectClient.addPaymentTransaction(ctCart.id, paymentTransaction);
            }

            const updatedCart = await CommercetoolsCartClient.updateCart(ctCart.id, ctCart.version, updateActions);
            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(updatedCart)
            const cartWithUpdatedPrice = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)
            const iCart = commercetoolsMeCartClient.mapCartToICart(cartWithUpdatedPrice);

            return { ...iCart, hasChanged: cartWithUpdatedPrice.compared };
        } catch (error: any) {
            logger.error(`CartService.checkout.error`, error);
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'checkout');
        }
    };

    public getCartById = async (
        accessToken: string,
        id: string,
        selectedOnly = false,
        includeCoupons = false,
    ): Promise<ICart> => {
        try {
            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            // 1) Fetch the cart
            const ctCart = await commercetoolsMeCartClient.getCartById(id);
            if (!ctCart) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Cart not found or has expired'
                });
            }

            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(ctCart)
            const cartWithUpdatedPrice = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)

            // 2) Possibly auto-remove invalid coupons
            let cartAfterAutoRemove: Cart = cartWithUpdatedPrice;
            let permanentlyInvalidRejectedCoupons: Coupon[] = [];
            let couponEffects: ICoupon = {
                coupons: {
                    acceptedCoupons: [],
                    rejectedCoupons: [],
                },
            };
            if (includeCoupons) {
                const {
                    updatedCart: _cartAfterAutoRemove,
                    permanentlyInvalidRejectedCoupons: _permanentlyInvalidRejectedCoupons
                } = await this.couponService.autoRemoveInvalidCouponsAndReturnOnce(cartWithUpdatedPrice);
                cartAfterAutoRemove = _cartAfterAutoRemove;
                permanentlyInvalidRejectedCoupons = _permanentlyInvalidRejectedCoupons;
                couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCartId(cartAfterAutoRemove.id, cartAfterAutoRemove.lineItems);
            }

            const selectedLineItems: LineItem[] = commercetoolsMeCartClient.filterSelectedLineItems(cartAfterAutoRemove.lineItems, selectedOnly);
            const cartWithFilteredItems: Cart = { ...cartAfterAutoRemove, lineItems: selectedLineItems };

            // 3) Map to ICart
            const iCartWithBenefit: ICart = await commercetoolsMeCartClient.getCartWithBenefit(cartWithFilteredItems);

            const response = {
                ...iCartWithBenefit,
                hasChanged: cartWithUpdatedPrice.compared,
                ...couponEffects
            };

            if (includeCoupons && permanentlyInvalidRejectedCoupons.length > 0) {
                response.coupons.rejectedCoupons = [
                    ...(response.coupons.rejectedCoupons ?? []),
                    ...permanentlyInvalidRejectedCoupons
                ];
            }

            return response;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }
            throw createStandardizedError(error, 'getCartById');
        }
    };

    public getCartByIdV2 = async (
        accessToken: string,
        cartId: string,
        selectedOnly = false,
        includeCoupons = false
    ): Promise<ICart> => {
        try {
            console.log('selectedOnly', selectedOnly);
            console.log('includeCoupons', includeCoupons);

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            // 1) Fetch the cart from Commercetools
            const ctCart = await commercetoolsMeCartClient.getCartById(cartId);
            if (!ctCart) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Cart not found or has expired',
                }, 'getCartById');
            }

            // 2) Check for price/availability changes in the FULL (unfiltered) cart
            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(ctCart);
            const updatedCart = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged);

            // 3) If `includeCoupons` is true, possibly do coupon auto-removal on the real updatedCart
            let finalCart: Cart = updatedCart;
            if (includeCoupons) {
                const {
                    updatedCart: couponCart,
                    permanentlyInvalidRejectedCoupons,
                } = await this.couponService.autoRemoveInvalidCouponsAndReturnOnce(updatedCart);

                finalCart = couponCart;
            }

            // 4) **Ephemeral** filter for the response if `selectedOnly === true`.
            const ephemeralCart = {
                ...finalCart,
                lineItems: selectedOnly
                    ? finalCart.lineItems.filter(li => li.custom?.fields?.selected === true)
                    : finalCart.lineItems,
            };

            // 5) Convert ephemeralCart to ICart for the response
            const iCart = commercetoolsMeCartClient.mapCartToICart(ephemeralCart);

            // 6) Optionally attach any coupon effects if `includeCoupons` is true
            if (includeCoupons) {
                const couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCartId(
                    finalCart.id,
                    finalCart.lineItems
                );
                return {
                    ...iCart,
                    hasChanged: updatedCart.compared,
                    ...couponEffects,
                };
            }

            // 7) If no coupons needed, just return ephemeral iCart
            return {
                ...iCart,
                hasChanged: updatedCart.compared,
            };
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }
            throw createStandardizedError(error, 'getCartById');
        }
    };

    public getCtCartById = async (accessToken: string, id: string): Promise<Cart> => {
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
             // Get coupon information
            const couponDiscounts = await this.getCouponInformation(orderNumber ,COUPON_INFO_CONTAINER, cart.id)
            const tsmOrder = new TsmOrderModel({ ctCart: cart, config, orderNumber, couponDiscounts })
            const tsmOrderPayload = tsmOrder.toPayload()

            logger.info(`tsmOrderPayload: ${JSON.stringify(tsmOrderPayload)}`)
            return {
                success: false,
                response: { message: 'this is mock response' }
            }
            const response = await apigeeClientAdapter.saveOrderOnline(tsmOrderPayload)
            const { code } = response || {}

            // if (code !== '0') {
            //     throw {
            //         statusCode: HTTP_STATUSES.BAD_REQUEST,
            //         statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
            //         errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED'
            //     };
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
                ...(['truemoney'].includes(paymentOptionKey) ? { paymentTMNAccountNumber } : {}),
                ...(['ccw', 'installment'].includes(paymentOptionKey) ? { paymentCreditCardNumber } : {}),
                ...(ip ? { ipAddress: ip } : {}),
                ...(googleId ? { googleID: googleId } : {}),
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
                const { promotionSetCode, maxReceive, group, benefitType, maxItem } = availableBenefit

                if (!acc?.[promotionSetCode]) {
                    acc[promotionSetCode] = {
                        remainingMaxReceive: maxReceive,
                        remainingMaxItem: {}
                    }
                }

                acc[promotionSetCode].remainingMaxItem = {
                    ...acc[promotionSetCode].remainingMaxItem,
                    [benefitType]: {
                        ...acc[promotionSetCode].remainingMaxItem[benefitType],
                        [group]: maxItem
                    }
                }

                return acc
            }), {})

            acc[productGroup] = groupMap

            return acc
        }, {});


        const freeGiftLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'free_gift')

        const addOnLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'add_on')

        const secondaryLineItems = [...freeGiftLineItems, ...addOnLineItems]

        validateObject = secondaryLineItems.reduce((acc: any, addOnLineItem: any) => {
            const quantity = addOnLineItem.quantity;
            const productGroup = addOnLineItem?.custom?.fields?.productGroup;
            const productType = addOnLineItem?.custom?.fields?.productType;
            const addOnGroup = addOnLineItem?.custom?.fields?.addOnGroup;
            const freeGiftGroup = addOnLineItem?.custom?.fields?.freeGiftGroup;
            let privilege = addOnLineItem?.custom?.fields?.privilege;
            privilege = privilege ? JSON.parse(privilege) : null;

            const productTypeText = productType === 'add_on' ? 'add-on' : 'free gift';

            const benefitGroup = productType === 'add_on' ? addOnGroup : freeGiftGroup;

            if (!privilege) {
                throw new Error(`Invalid ${productTypeText} product`);
            }

            const groupMap = acc[productGroup]

            if (!groupMap) {
                throw new Error(`Invalid ${productTypeText} product`);
            }

            const { promotionSetCode } = privilege
            const limit = groupMap[promotionSetCode]

            if (!limit) {
                throw new Error(`Invalid ${productTypeText} product`);
            }

            const { remainingMaxReceive, remainingMaxItem } = limit

            if (!remainingMaxItem[productType]) {
                throw new Error(`Invalid ${productTypeText} product`);

            }

            acc[productGroup] = {
                ...acc[productGroup],
                [promotionSetCode]: {
                    remainingMaxReceive: remainingMaxReceive - quantity,
                    remainingMaxItem: {
                        ...remainingMaxItem,
                        [productType]: {
                            ...remainingMaxItem[productType],
                            [benefitGroup]: remainingMaxItem[productType][benefitGroup] - quantity,
                        }
                    }
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
                Object.entries(remainingMaxItem as Record<string, any>).forEach(([benefitType, groupMaxItem]) => {

                    const productTypeText = benefitType === 'add_on' ? 'add-on' : 'free gift';

                    Object.entries(groupMaxItem as Record<string, number>).forEach(
                        ([group, maxItem]) => {
                            if (maxItem < 0) {
                                throw new Error(
                                    `Total ${productTypeText} group "${group}" reach limit for product group "${productGroup}"`
                                );
                                return
                            }
                        }
                    )
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
            logger.error('CartService.validateCampaign.error', error)
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

    private async generateOrderNumber(company: string) {
        const MAXIMUM_RUNNING_NUMBER = 99999;
        const CONTAINER_KEY = 'orderNumber';

        dayjs.extend(utc);
        dayjs.extend(timezone);
        const currentDate = dayjs().tz('Asia/Bangkok');

        const companyAbbr = company === 'DTAC' ? 'D' : 'T';

        const key = `${companyAbbr}${currentDate.format('YYYYMM')}`;

        const maxRetries = 3
        let retries = 0
        let newCounter = 1
        while (retries < maxRetries) {

            try {
                const existingObject = await CommercetoolsCustomObjectClient.getCustomObjectByContainerAndKey(CONTAINER_KEY, key)
                newCounter = existingObject.value + 1
                await CommercetoolsCustomObjectClient.createOrUpdateCustomObject({
                    container: CONTAINER_KEY,
                    key,
                    value: newCounter,
                    version: existingObject.version
                })

                const runningNumber = newCounter % MAXIMUM_RUNNING_NUMBER
                const orderNumberFormatted = `${companyAbbr}${currentDate.format('YYYYMMDD')}${runningNumber.toString().padStart(5, '0')}`

                return orderNumberFormatted
            } catch (err: any) {
                if (err.statusCode === 404) {
                    await CommercetoolsCustomObjectClient.createOrUpdateCustomObject({
                        container: CONTAINER_KEY,
                        key,
                        value: newCounter,
                        version: 0
                    })
                    const orderNumberFormatted = `${companyAbbr}${currentDate.format('YYYYMMDD')}${newCounter.toString().padStart(5, '0')}`
                    return orderNumberFormatted
                }
                retries = retries + 1
                continue // Retry on conflict
            }
        }

        throw new Error("Failed after maximum retries")
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

    private async getCouponInformation(orderNumber: string, container: string, cartId: string) {
        let couponResult: any[] = []
        try {
            const customObjectCouponInformation = await CommercetoolsCustomObjectClient.getCustomObjectByContainerAndKey(container, cartId)
            if (customObjectCouponInformation) {
                couponResult = customObjectCouponInformation.value
            }
        } catch (error: any) {
            logger.error(`CartService.createOrder.getCouponInformation.error`, error);
            return { discounts: [], otherPayments: [] }
        }

        const discounts: { orderNumber: string; no: number; code: string; amount: string; serial: string }[] = [];
        const otherPayments: { orderNumber: string; no: number; code: string; amount: string; serial: string }[] = [];
        let discountNo = 1;
        let otherPaymentNo = 1;

        couponResult.forEach((item: any) => {

            if (item.discountCode.toUpperCase() !== "NULL") {
                discounts.push({
                    orderNumber,
                    no: discountNo,
                    code: item.couponCode,
                    amount: item.discountPrice.toString(),
                    serial: "",
                });
                discountNo++;
            }

            if (item.otherPaymentCode.toUpperCase() !== "NULL") {
                otherPayments.push({
                    orderNumber,
                    no: otherPaymentNo,
                    code: item.otherPaymentCode,
                    amount: item.discountPrice.toString(),
                    serial: "",
                });
                otherPaymentNo++;
            }
        });

        return { discounts, otherPayments };
    }
}