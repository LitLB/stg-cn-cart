// cart/src/services/cart.service.ts

import _ from 'lodash'
import { Cart, CartUpdateAction, LineItem, MyCartUpdateAction, Order, Product } from '@commercetools/platform-sdk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
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
import { InventoryValidator } from '../validators/inventory.validator';
import { InventoryService } from './inventory.service';
import { validateInventory } from '../utils/cart.utils';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { validateCouponLimit, validateCouponDiscount } from '../validators/coupon.validator';
import { FUNC_CHECKOUT } from '../constants/func.constant';
import { CART_HAS_CHANGED_NOTICE_MESSAGE, CART_JOURNEYS } from '../constants/cart.constant';
import { ApiResponse, IHeadlessCheckEligibleResponse } from '../interfaces/response.interface';
import { attachPackageToCart, attachSimToCart } from '../helpers/cart.helper';
import { CartTransformer } from '../transforms/cart.transforms';
import { CompareRedisData } from '../types/share.types';
import HeadlessClientAdapter from '../adapters/hl-client.adapter';
import { calculateAge } from '../utils/calculate.utils';
import { areArraysEqual } from '../utils/array.utils';

export class CartService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;
    private blacklistService: BlacklistService;
    private couponService: CouponService;
    private inventoryService: InventoryService;
    private cartTransformer: CartTransformer;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
        this.blacklistService = new BlacklistService()
        this.couponService = new CouponService()
        this.inventoryService = new InventoryService()
        this.cartTransformer = new CartTransformer();
    }

    async getCurrentAndUpdatedCouponEffects(accessToken: string, id: string, body: any): Promise<any> {
        try {
            const { cartId } = body;

            const customerSession = await talonOneIntegrationAdapter.getCustomerSession(cartId);

            // Get Current Effects
            const currentProcessedCouponEffects = this.talonOneCouponAdapter.processCouponEffectsV2(customerSession.effects);
            console.log('currentProcessedCouponEffects', currentProcessedCouponEffects);

            // Get Updated Effects
            const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                couponCodes: currentProcessedCouponEffects.couponCodes,
            });
            const updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(
                cartId,
                customerSessionPayload
            );
            const updatedProcessedCouponEffects = this.talonOneCouponAdapter.processCouponEffectsV2(updatedCustomerSession.effects);
            console.log('updatedProcessedCouponEffects', updatedProcessedCouponEffects);

            return { currentProcessedCouponEffects, updatedProcessedCouponEffects };
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(
                error,
                'getCurrentAndUpdatedCouponEffects'
            );
        }
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
            const { campaignGroup, journey, locale, customerInfo } = createAnonymousCartInput;

            const custInfo = customerInfo ?? {} as Record<string, string>

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await commercetoolsMeCartClient.createCart(campaignGroup, journey, locale, custInfo);

            await this.initialTalonOneSession(cart)

            const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(cart);

            return iCart;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'createAnonymousCart');
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


            const { cartId, client, headers } = payload;
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
            let tsmSaveOrder = {}

            const operator = ctCart.custom?.fields.operator
            const orderNumber = await this.generateOrderNumber(operator)

            const isPreOrder = ctCart.custom?.fields.preOrder
            const cartJourney = ctCart.custom?.fields.journey as CART_JOURNEYS

            if ([CART_JOURNEYS.DEVICE_BUNDLE_EXISTING, CART_JOURNEYS.DEVICE_BUNDLE_NEW, CART_JOURNEYS.DEVICE_BUNDLE_P2P].includes(cartJourney)) {
                try {


                    const mainProduct = ctCart.lineItems.find(item => item.custom?.fields.productType === 'main_product') as LineItem
                    const bundleProduct = ctCart.lineItems.find(item => item.custom?.fields.productType === 'bundle') as LineItem

                    if (!mainProduct || !bundleProduct) {
                        throw {
                            statusCode: HTTP_STATUSES.BAD_REQUEST,
                            statusMessage: 'Main product or bundle product not found',
                        }
                    }
                    const mainProductSku = mainProduct.variant.sku as string
                    const bundleProductAttributes = bundleProduct.variant.attributes
                    const campaignCode = bundleProductAttributes?.find(attr => attr.name === 'campaignCode')?.value
                    const propositionCode = bundleProductAttributes?.find(attr => attr.name === 'propositionCode')?.value
                    const promotionSetCode = bundleProductAttributes?.find(attr => attr.name === 'promotionSetCode')?.value
                    const agreementCode = bundleProductAttributes?.find(attr => attr.name === 'agreementCode')?.value

                    const bundleProductInfo = {
                        campaignCode,
                        propositionCode,
                        promotionSetCode,
                        agreementCode
                    }

                    const eligibleResponse = await this.checkEligible(ctCart, mainProductSku, bundleProductInfo, headers)

                    this.validateDiscounts(ctCart, eligibleResponse, mainProduct)

                    await this.closeSessionIfExist(ctCart.id)
                } catch (error: any) {
                    if (error.status && error.message) {
                        throw error;
                    }
                    throw createStandardizedError(error, 'createOrder')
                }
            }

            CartValidator.validateCartHasSelectedItems(ctCart);

            // * STEP #2 - Validate Blacklist
            if (validateList.includes('BLACKLIST')) {
                await this.validateBlacklist(ctCart, client)
            }

            // * STEP #3 - Validate Campaign & Promotion Set
            if (validateList.includes('CAMPAIGN')) {
                await this.validateCampaign()
            }

            // * STEP #4 - Validate Available Quantity (Commercetools)
            await this.validateAvailableQuantity(ctCart)
            ctCart = await this.handleAutoRemoveCoupons(ctCart);
            ctCart = await this.removeUnselectedItems(ctCart);
            await InventoryValidator.validateCart(ctCart);

            if (!isPreOrder) {
                // * STEP #5 - Create Order On TSM Sale
                const { success, response } = await this.createTSMSaleOrder(orderNumber, ctCart)

                if (!success) {
                    await InventoryValidator.validateSafetyStock(ctCart)
                }

                tsmSaveOrder = {
                    tsmOrderIsSaved: success,
                    tsmOrderResponse: typeof response === 'string' ? response : JSON.stringify(response)
                }

            }

            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(ctCart)
            const { ctCart: cartWithUpdatedPrice, compared } = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)
            await this.inventoryService.commitCartStock(ctCart);
            const order = await commercetoolsOrderClient.createOrderFromCart(orderNumber, cartWithUpdatedPrice, tsmSaveOrder);
            await this.createOrderAdditional(order, client);
            return { ...order, hasChanged: compared };

        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'createOrder');
        }
    };

    private async handleAutoRemoveCoupons(ctCart: Cart): Promise<Cart> {
        // 1. Auto-remove invalid coupons
        const { updatedCart } =
            await this.couponService.autoRemoveInvalidCouponsAndReturnOnceV2(ctCart);
        ctCart = updatedCart;

        // 2. Grab coupon data
        const cartInfoForCouponValidation = await this.couponService.getCartInfoForCouponValidation(ctCart)
        const couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCart(ctCart, cartInfoForCouponValidation);

        // 3. Construct updateActions from coupon effects
        const updateActions: CartUpdateAction[] = [];
        const { couponsEffects, talonOneUpdateActions } =
            await this.talonOneCouponAdapter.fetchCouponEffectsAndUpdateActionsByCtCart(
                ctCart,
                cartInfoForCouponValidation,
                couponEffects.coupons
            );

        if (talonOneUpdateActions?.updateActions) {
            updateActions.push(...talonOneUpdateActions.updateActions);
        }

        // Check coupon price change
        const couponPriceChange = await CommercetoolsCustomObjectClient.checkCouponPriceChange(
            ctCart.id,
            talonOneUpdateActions?.couponsInformation
        );
        if (couponPriceChange.length > 0) {
            // Update customObject coupon information
            await this.couponService.addCouponInformation(updateActions, ctCart.id, talonOneUpdateActions?.couponsInformation);
            throw createStandardizedError(
                {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Some coupons experienced a price change during processing.',
                    data: couponPriceChange,
                },
                'handleAutoRemoveCoupons'
            );
        }

        // 4. Possibly add coupon info
        await this.couponService.addCouponInformation(
            updateActions,
            ctCart.id,
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

            const { shippingAddress, billingAddress, shippingMethodId, payment, simInfo } = value;

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const ctCart = await commercetoolsMeCartClient.getCartById(id);
            if (!ctCart) {
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'Cart not found or has expired',
                };
            }
            const cartInfoForCouponValidation = await this.couponService.getCartInfoForCouponValidation(ctCart)
            const couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCart(ctCart, cartInfoForCouponValidation);

            const { talonOneUpdateActions } =
                await this.talonOneCouponAdapter.fetchCouponEffectsAndUpdateActionsByCtCart(
                    ctCart,
                    cartInfoForCouponValidation,
                    couponEffects.coupons
                );

            const { ctCart: cartWithCheckPublicPublish, notice } = await CommercetoolsCartClient.validateProductIsPublished(ctCart)
            const { couponsInfomation } = cartWithCheckPublicPublish.custom?.fields ?? {};
            const couponsInformation = couponsInfomation?.obj?.value ?? []

            const validatedCoupon = await validateCouponLimit(couponsInformation.length, FUNC_CHECKOUT)
            if (validatedCoupon) {
                const removeFlag = notice !== '' || cartWithCheckPublicPublish.lineItems.length === 0

                await this.couponService.autoRemoveInvalidCouponsAndReturnOnce(cartWithCheckPublicPublish, removeFlag)

                throw createStandardizedError(
                    {
                        statusCode: validatedCoupon.statusCode,
                        statusMessage: validatedCoupon.statusMessage,
                        errorCode: validatedCoupon.errorCode
                    },
                    'checkout'
                );
            }

            if (notice !== '') {
                let errorCode

                switch (notice as CART_HAS_CHANGED_NOTICE_MESSAGE) {
                    case CART_HAS_CHANGED_NOTICE_MESSAGE.DUMMY_TO_PHYSICAL_INSUFFICIENT_STOCK:
                        errorCode = 'DUMMY_TO_PHYSICAL_INSUFFICIENT_STOCK'
                        break;
                    default:
                        errorCode = 'CART_HAS_CHANGED'
                        break;
                }

                throw createStandardizedError(
                    {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: notice,
                        errorCode: errorCode,
                    },
                    'getCartById'
                );
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

            if (payment && payment?.key) { // no payment
                const paymentTransaction = {
                    paymentOptionContainer: 'paymentOptions',
                    paymentOptionKey: payment.key, // e.g., 'installment', 'ccw', etc.
                    source: payment?.source || null,
                    token: payment?.token || null,
                    additionalData: payment?.additionalData || null,
                    createdAt: new Date().toISOString(),
                };

                await CommercetoolsCustomObjectClient.addPaymentTransaction(cartWithCheckPublicPublish.id, paymentTransaction);
            } else if (!payment?.key && ctCart?.totalPrice?.centAmount <= 0) {
                const paymentTransaction = {
                    paymentOptionContainer: 'paymentOptions',
                    paymentOptionKey: 'nopayment', // e.g., 'installment', 'ccw', etc.
                    source: null,
                    token: null,
                    additionalData: null,
                    createdAt: new Date().toISOString(),
                };

                await CommercetoolsCustomObjectClient.addPaymentTransaction(cartWithCheckPublicPublish.id, paymentTransaction);
            }

            const updatedCart = await CommercetoolsCartClient.updateCart(cartWithCheckPublicPublish.id, cartWithCheckPublicPublish.version, updateActions);
            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(updatedCart)
            const { ctCart: cartWithUpdatedPrice, compared } = await CommercetoolsCartClient.updateCartWithNewValue(ctCartWithChanged)

            const priceChange = await this.checkPriceChange(compared)
            const validatedCouponDiscount = await validateCouponDiscount(cartWithUpdatedPrice, talonOneUpdateActions?.couponsInformation, FUNC_CHECKOUT)

            if (validatedCouponDiscount) {
                const customerSession = await talonOneIntegrationAdapter.getCustomerSession(cartWithUpdatedPrice.id);
                const updatedCartWithRemoveCoupon = await this.couponService.clearAllCoupons(cartWithUpdatedPrice, customerSession);
                const ctCartWithRemoveCoupon = await CommercetoolsProductClient.checkCartHasChanged(updatedCartWithRemoveCoupon)

                const { ctCart: cartWithRemoveCoupon, compared: comparedWithRemovecoupon } = await CommercetoolsCartClient.updateCartWithNewValue(ctCartWithRemoveCoupon)

                const iCartWithRemoveCoupon = await commercetoolsMeCartClient.updateCartWithBenefit(cartWithRemoveCoupon);

                throw createStandardizedError(
                    {
                        statusCode: validatedCouponDiscount.statusCode,
                        statusMessage: validatedCouponDiscount.statusMessage,
                        errorCode: validatedCouponDiscount.errorCode
                    },
                    'checkout'
                );
            }

            if (priceChange) {
                await commercetoolsMeCartClient.updateCartWithBenefit(cartWithUpdatedPrice);
                throw createStandardizedError(
                    {
                        statusCode: priceChange.statusCode,
                        statusMessage: priceChange.statusMessage,
                        errorCode: priceChange.errorCode
                    },
                    'checkout'
                );
            }

            const iCartWithBenefit = await commercetoolsMeCartClient.updateCartWithBenefit(cartWithUpdatedPrice);

            return { ...iCartWithBenefit, hasChanged: compared, couponsInformation, notice };
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

            const { ctCart: cartWithCheckPublicPublish, notice } = await CommercetoolsCartClient.validateProductIsPublished(ctCart)
            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(cartWithCheckPublicPublish)
            const { ctCart: cartWithUpdatedPrice, compared } = await CommercetoolsCartClient.updateCartWithNewValue(ctCartWithChanged)

            // 2) Possibly auto-remove invalid coupons
            let cartAfterAutoRemove: Cart = cartWithUpdatedPrice;
            let permanentlyInvalidRejectedCoupons: Coupon[] = [];
            let couponEffects: ICoupon = {
                coupons: {
                    acceptedCoupons: [],
                    rejectedCoupons: [],
                },
            };

            let couponsInformation = []
            if (includeCoupons) {
                const {
                    updatedCart: _cartAfterAutoRemove,
                    permanentlyInvalidRejectedCoupons: _permanentlyInvalidRejectedCoupons
                } = await this.couponService.autoRemoveInvalidCouponsAndReturnOnce(cartWithUpdatedPrice);

                if (notice !== '') {
                    let errorCode

                    switch (notice as CART_HAS_CHANGED_NOTICE_MESSAGE) {
                        case CART_HAS_CHANGED_NOTICE_MESSAGE.DUMMY_TO_PHYSICAL_INSUFFICIENT_STOCK:
                            errorCode = 'DUMMY_TO_PHYSICAL_INSUFFICIENT_STOCK'
                            break;
                        default:
                            errorCode = 'CART_HAS_CHANGED'
                            break;
                    }

                    throw createStandardizedError(
                        {
                            statusCode: HTTP_STATUSES.BAD_REQUEST,
                            statusMessage: notice,
                            errorCode: errorCode,
                        },
                        'getCartById'
                    );
                }

                cartAfterAutoRemove = _cartAfterAutoRemove;
                permanentlyInvalidRejectedCoupons = _permanentlyInvalidRejectedCoupons;

                const cartInfoForCouponValidation = await this.couponService.getCartInfoForCouponValidation(cartAfterAutoRemove)
                couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCart(cartAfterAutoRemove, cartInfoForCouponValidation);

                // * I pushed expend (couponsInfomation) to update method in CT but CT return only object id without object value
                const ctCartWithUpdateCouponEffect = await commercetoolsMeCartClient.getCartById(id);
                if (!ctCartWithUpdateCouponEffect) {
                    throw createStandardizedError({
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: 'Cart not found or has expired'
                    });
                }
                const { couponsInfomation } = ctCartWithUpdateCouponEffect.custom?.fields ?? {};
                couponsInformation = couponsInfomation?.obj.value || []
            }

            if (notice !== '') {
                let errorCode

                switch (notice as CART_HAS_CHANGED_NOTICE_MESSAGE) {
                    case CART_HAS_CHANGED_NOTICE_MESSAGE.DUMMY_TO_PHYSICAL_INSUFFICIENT_STOCK:
                        errorCode = 'DUMMY_TO_PHYSICAL_INSUFFICIENT_STOCK'
                        break;
                    default:
                        errorCode = 'CART_HAS_CHANGED'
                        break;
                }

                throw createStandardizedError(
                    {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: notice,
                        errorCode: errorCode,
                    },
                    'getCartById'
                );
            }

            const selectedLineItems: LineItem[] = commercetoolsMeCartClient.filterSelectedLineItems(cartAfterAutoRemove.lineItems, selectedOnly);
            const cartWithFilteredItems: Cart = { ...cartAfterAutoRemove, lineItems: selectedLineItems };

            // 3) Map to ICartc
            let iCartWithBenefit: ICart = await commercetoolsMeCartClient.getCartWithBenefit(cartWithFilteredItems);
            iCartWithBenefit = await attachPackageToCart(iCartWithBenefit, ctCart);
            iCartWithBenefit = attachSimToCart(iCartWithBenefit, ctCart)

            const response = {
                ...iCartWithBenefit,
                hasChanged: compared,
                hasChangedNote: notice,
                ...couponEffects,
                couponsInformation
            };

            if (includeCoupons && permanentlyInvalidRejectedCoupons.length > 0) {
                response.coupons.rejectedCoupons = [
                    ...(response.coupons.rejectedCoupons ?? []),
                    ...permanentlyInvalidRejectedCoupons
                ];
            }

            return response;
        } catch (error: any) {
            console.log('error', error);

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
            const couponDiscounts = await this.getCouponInformation(orderNumber, COUPON_INFO_CONTAINER, cart.id)
            const tsmOrder = new TsmOrderModel({ ctCart: cart, config, orderNumber, couponDiscounts })
            const tsmOrderPayload = await tsmOrder.toPayload()

            logger.info(`tsmOrderPayload: ${JSON.stringify(tsmOrderPayload)}`)
            // return {
            //     success: false,
            //     response: { message: 'this is mock response' }
            // }
            const response = await apigeeClientAdapter.saveOrderOnline(tsmOrderPayload)

            if (!response) {
                return {
                    success: false,
                    response: { message: 'Internal Server Error' }
                }
            }

            const { code } = response || {}
            return {
                success: code === '0',
                response
            }

            // if (code !== '0') {
            //     throw {
            //         statusCode: HTTP_STATUSES.BAD_REQUEST,
            //         statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
            //         errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED'
            //     };
            // }

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

    private async validateCampaign() {
        try {
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
        const skipValidateProductType = ['promotion_set', 'bundle']
        const cartJourney = ctCart.custom?.fields.journey
        try {
            const { lineItems } = ctCart
            for (const lineItem of lineItems) {
                const productType = lineItem.custom?.fields?.productType;

                if (skipValidateProductType.includes(productType)) {
                    continue
                }

                const sku = lineItem.variant.sku as string;
                const productId = lineItem.productId;
                const simInfo = lineItem.custom?.fields?.simInfo?.[0];
                const simType = simInfo ? JSON.parse(simInfo).simType : null;

                if (productType !== 'main_product' && cartJourney === CART_JOURNEYS.DEVICE_BUNDLE_EXISTING) {
                    continue
                } else if (productType !== 'main_product' && simType !== 'physical' && cartJourney === CART_JOURNEYS.DEVICE_BUNDLE_NEW) {
                    continue
                }

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
                const { isDummyStock, isOutOfStock } = validateInventory(inventory)

                if (isOutOfStock && !isDummyStock) {
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

        const companyAbbr = `${company}`.toUpperCase() === 'DTAC' ? 'D' : 'T';

        const key = `${companyAbbr}${currentDate.format('YYMM')}`;

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

                const runningNumber = newCounter % MAXIMUM_RUNNING_NUMBER || 99999
                const orderNumberFormatted = `${companyAbbr}${currentDate.format('YYMMDD')}${runningNumber.toString().padStart(5, '0')}`

                return orderNumberFormatted
            } catch (err: any) {
                if (err.statusCode === 404) {
                    await CommercetoolsCustomObjectClient.createOrUpdateCustomObject({
                        container: CONTAINER_KEY,
                        key,
                        value: newCounter,
                        version: 0
                    })
                    const orderNumberFormatted = `${companyAbbr}${currentDate.format('YYMMDD')}${newCounter.toString().padStart(5, '0')}`
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

        const discounts: { id: string; no: string; code: string; amount: string; serial: string }[] = [];
        const otherPayments: { id: string; no: string; code: string; amount: string; serial: string }[] = [];
        let discountNo = 1;
        let otherPaymentNo = 1;

        couponResult.filter((item: any) => !item?.lineItemId).forEach((item: any) => {

            if (item.discountCode.toUpperCase() !== "NULL") {
                discounts.push({
                    id: orderNumber,
                    no: discountNo.toString(),
                    code: item.couponCode,
                    amount: item.discountPrice.toString(),
                    serial: "",
                });
                discountNo++;
            }

            if (item.otherPaymentCode.toUpperCase() !== "NULL") {
                otherPayments.push({
                    id: orderNumber,
                    no: otherPaymentNo.toString(),
                    code: item.otherPaymentCode,
                    amount: item.discountPrice.toString(),
                    serial: "",
                });
                otherPaymentNo++;
            }
        });

        return { discounts, otherPayments };
    }

    public checkPriceChange = async (
        compared: any,
    ): Promise<void | ApiResponse> => {
        let priceUpdated = false;
        for (const item of compared) {
            let isPriceHasChange = item?.hasChange?.prices || false;
            if (isPriceHasChange) {
                priceUpdated = true;
                break;
            }
        }
        if (priceUpdated) {
            return {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                errorCode: "PRICE_HAS_BEEN_CHANGED",
                statusMessage: 'price has changed',
            };
        }
    };

    public checkUpdateCart = async (
        accessToken: any,
        body: any
    ): Promise<any> => {
        try {
            const { cartId, correlationid, redisData, flows } = body

            // step 1: Get Active flows
            const activeFlows = Object.keys(flows).filter(key => flows[key]);

            // step 2: Get Cart
            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
            const ctCart = await commercetoolsMeCartClient.getCartById(cartId);
            if (!ctCart) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Cart not found or has expired'
                });
            }

            // step 3: Map flows with redisData
            const mapRedisData = activeFlows.reduce((result, key) => {
                if (redisData[key]) { result[key] = redisData[key]; }
                return result;
            }, {} as Record<string, any>);

            const updateActions: MyCartUpdateAction[] = [];
            for (const key of Object.keys(mapRedisData)) {
                const data = mapRedisData[key];
                let compareed: CompareRedisData;

                switch (key) {
                    case 'pdp':
                        compareed = await this.cartTransformer.comparePdpData(data, ctCart);
                        if (!compareed.isEqual) {
                            const action = await this.cartTransformer.updatePdpData(compareed.dataChange, ctCart);
                            if (action.length > 0) {
                                updateActions.push(...action);
                            }
                        }
                        break;

                    case 'select_number':
                        compareed = await this.cartTransformer.compareSelectNumberData(data, ctCart);
                        if (!compareed.isEqual) {
                            const action = await this.cartTransformer.updateSelectNumberData(compareed.dataChange, correlationid, ctCart);
                            if (action.length > 0) {
                                updateActions.push(...action);
                            }
                        }
                        break;

                    case 'verification':
                        compareed = await this.cartTransformer.compareVerificationData(data, ctCart);
                        // Add an update function to update data if changes are detected.
                        break;

                    case 'consent':
                        compareed = await this.cartTransformer.compareConsentData(data, ctCart);
                        // Add an update function to update data if changes are detected.
                        break;

                    case 'offer':
                        compareed = await this.cartTransformer.compareOfferData(data, ctCart);
                        if (!compareed.isEqual) {
                            const action = await this.cartTransformer.updateOfferData(compareed.dataChange, ctCart);
                            if (action.length > 0) {
                                updateActions.push(...action);
                            }
                        }
                        break;

                    case 'ekyc':
                        compareed = await this.cartTransformer.compareEkycData(data, ctCart);
                        // Add an update function to update data if changes are detected.
                        break;

                    case 'billing_info_address':
                        compareed = await this.cartTransformer.compareBillingInfoAddressData(data, ctCart);
                        if (!compareed.isEqual) {
                            const action = await this.cartTransformer.updateBillingInfoAddressData(compareed.dataChange, ctCart);
                            if (action.length > 0) {
                                updateActions.push(...action);
                            }
                        }
                        break;

                    default:
                        break;
                }
            }

            if (updateActions.length > 0) {
                const { ctCart: cartWithCheckPublicPublish, notice } = await CommercetoolsCartClient.validateProductIsPublished(ctCart)
                const updatedCart = await CommercetoolsCartClient.updateCart(cartWithCheckPublicPublish.id, cartWithCheckPublicPublish.version, updateActions);
                const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(updatedCart)
                const { ctCart: cartWithUpdatedPrice, compared } = await CommercetoolsCartClient.updateCartWithNewValue(ctCartWithChanged)
                const updateSelectItems = await this.cartTransformer.getUpdateSelectItem(cartWithUpdatedPrice);
                const updatedCartSelected = await CommercetoolsCartClient.updateCart(cartWithUpdatedPrice.id, cartWithUpdatedPrice.version, updateSelectItems);
                const ctCartWithSelected = await CommercetoolsProductClient.checkCartHasChanged(updatedCartSelected)
                const { ctCart: cartWithSelected, compared: comparedSelected } = await CommercetoolsCartClient.updateCartWithNewValue(ctCartWithSelected)
                return cartWithSelected;
            } else {
                return ctCart;
            }
        } catch (error: any) {
            console.error(error)
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: error?.statusMessage || error.message || EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CHECK_UPDATE_CART_FAILED'
            };
        }
    };

    initialTalonOneSession = async (ctCart: Cart) => {
        const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload()

        const customerSessionId = ctCart?.id
        const customerSession = await talonOneIntegrationAdapter.updateCustomerSession(customerSessionId, customerSessionPayload)

        return customerSession
    }

    public async checkEligible(ctCart: Cart, mainProductSku: string, bundleProductInfo: { campaignCode: string, propositionCode: string, promotionSetCode: string, agreementCode: string }, headers: any): Promise<IHeadlessCheckEligibleResponse> {
        const hlClient = new HeadlessClientAdapter()
        const customerInfo = JSON.parse(ctCart.custom?.fields.customerInfo)
        const { customerProfile } = customerInfo
        const bundleKey = `${bundleProductInfo.campaignCode}_${bundleProductInfo.propositionCode}_${bundleProductInfo.promotionSetCode}_${bundleProductInfo.agreementCode}`

        const headlessPayload = {
            operator: customerProfile.operator,
            companyCode: customerProfile.companyCode,
            profile: [
                {
                    certificationId: customerProfile.certificationId,
                    certificationType: customerProfile.certificationType
                },
                {
                    certificationId: customerInfo.verifyMobileNumberValue,
                    certificationType: "M"
                }
            ],
            productBundle: {
                bundleKey: bundleKey,
                sku: mainProductSku,
                customerAge: calculateAge(customerProfile.age ?? 0),
            }
        }

        try {
            const response = await hlClient.checkEligible(headlessPayload, headers)

            return response.data
        } catch (e: any) {
            console.log('[CHECK_ELIGIBLE] Error', e)
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Campaign is not eligible',
            }
        }
    }

    private async closeSessionIfExist(ctCartId: string) {
        const customerSession = await talonOneIntegrationAdapter.getCustomerSession(ctCartId);

        if (customerSession && customerSession.effects.length > 0) {
            const customerSessionId = customerSession.customerSession.id
            await talonOneIntegrationAdapter.updateCustomerSession(customerSessionId, {
                customerSession: {
                    state: 'closed'
                }
            })
        }
    }

    private validateDiscounts(ctCart: Cart, eligibleResponse: IHeadlessCheckEligibleResponse, mainProduct: LineItem) {
        const eligibleDiscounts = eligibleResponse.prices.discounts.map((item) => item.type === 'discount' ? item : null).filter(Boolean).map((r) => {
            return {
                code: r?.code ?? '',
                amount: r?.amount ?? 0
            }
        })

        const eligibleOtherPayments = eligibleResponse.prices.discounts.map((item) => item.type === 'otherPayment' ? item : null).filter(Boolean).map((r) => {
            return {
                code: r?.code ?? '',
                amount: r?.amount ?? 0
            }
        })

        const cartDiscounts = ctCart.lineItems.find((lineItem: LineItem) => lineItem.productId === mainProduct.productId)?.custom?.fields?.discounts ?? []
        const cartOtherPayments = ctCart.lineItems.find((lineItem: LineItem) => lineItem.productId === mainProduct.productId)?.custom?.fields?.otherPayments ?? []

        // const cartDiscountsArray = [{ code: 'AAI0712_Device', amount: 5400 }, { code: 'AAI0713_Device', amount: 5400 }]

        const cartDiscountsArray = cartDiscounts && Array.isArray(cartDiscounts) ? cartDiscounts.map((item) => JSON.parse(item)) : []
        const cartOtherPaymentsArray = cartOtherPayments && Array.isArray(cartOtherPayments) ? cartOtherPayments.map((item) => JSON.parse(item)) : []

        // check if eligible discounts all value are in cart 
        const isEligibleDiscountsInCartDiscounts = areArraysEqual(eligibleDiscounts, cartDiscountsArray)
        const isEligibleOtherPaymentsInCartOtherPayments = areArraysEqual(eligibleOtherPayments, cartOtherPaymentsArray)

        if (!isEligibleDiscountsInCartDiscounts || !isEligibleOtherPaymentsInCartOtherPayments) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Discounts or other payments are not eligible',
            })
        }

    }
}