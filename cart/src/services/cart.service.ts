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
import { logger } from '../utils/logger.utils';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';
import { createStandardizedError } from '../utils/error.utils';
import { CreateAnonymousCartInput } from '../interfaces/create-anonymous-cart.interface';
import { IOrderAdditional, IPaymentInfo, IClientInfo } from '../interfaces/order-additional.interface';
import { HTTP_STATUSES } from '../constants/http.constant';
import { PAYMENT_STATES } from '../constants/payment.constant';
import { commercetoolsOrderClient } from '../adapters/ct-order-client';
import { CouponService } from './coupon.service';
import { ICoupon } from '../interfaces/coupon.interface';
import { ORDER_STATES } from '../constants/order.constant';
import { SHIPMENT_STATES } from '../constants/shipment.constant';
import { STATE_ORDER_KEYS } from '../constants/state.constant';

export class CartService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;
    private blacklistService: BlacklistService;
    private couponService: CouponService;
    private talonOneEffectConverter: typeof talonOneEffectConverter

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
        this.talonOneEffectConverter = talonOneEffectConverter
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

    // TODO :: CART HAS CHANGED
    public createOrder = async (accessToken: any, payload: any, partailValidateList: any[] = []): Promise<any> => {
        try {
            const{ cartId } = payload;
            return await this.createOrderWithSelectedOnly(accessToken, cartId);
            const orderNumber = this.generateOrderNumber()
            // const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
            const defaultValidateList = [
                'BLACKLIST',
                'CAMPAIGN',
            ]

            let validateList = defaultValidateList
            if (partailValidateList.length) {
                validateList = partailValidateList
            }

            let ctCart = await this.getCtCartById(accessToken, cartId);
            const selectedLineItems = ctCart.lineItems.filter(
                (lineItem) => lineItem.custom?.fields?.selected === true
            );
            if (selectedLineItems.length === 0) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'No selected items in the cart. Please select items before placing an order.',
                }, 'createOrder');
            }

            const unselectedLineItems = ctCart.lineItems.filter(
                (lineItem) => lineItem.custom?.fields?.selected !== true
            );
            console.log('ctCart.lineItems.length', ctCart.lineItems.length); // ctCart.lineItems.length 3
            console.log('selectedLineItems.length', selectedLineItems.length); // ctCart.lineItems.length 2
            console.log('unselectedLineItems.length', unselectedLineItems.length); // ctCart.lineItems.length 2

            // Step 3: Temporarily Remove Unselected Items from the Cart
            // const removeActions: CartUpdateAction[] = unselectedLineItems.map((lineItem) => ({
            //     action: 'removeLineItem',
            //     lineItemId: lineItem.id,
            // }));
            // if (removeActions.length > 0) {
            //     ctCart = await CommercetoolsCartClient.updateCart(
            //         ctCart.id,
            //         ctCart.version,
            //         removeActions
            //     );
            // }

            // const order = await commercetoolsOrderClient.createOrderFromCart(orderNumber, ctCart);

            // Step 8: Restore Unselected Items
            // const addActions: CartUpdateAction[] = unselectedLineItems.map((lineItem) => ({
            //     action: 'addLineItem',
            //     ...lineItem,
            // }));

            // if (addActions.length > 0) {
            //     await CommercetoolsCartClient.updateCart(ctCart.id, ctCart.version, addActions);
            // }

            // return order;
            // return ctCart;

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

            // const {
            //     updatedCart: cartAfterAutoRemove,
            //     permanentlyInvalidRejectedCoupons
            // } = await this.couponService.autoRemoveInvalidCouponsAndReturnOnce(ctCart);
            // ctCart = cartAfterAutoRemove;

            // const updateActions: CartUpdateAction[] = [];

            // const couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCartId(ctCart.id, ctCart.lineItems);
            // const { couponsEffects, talonOneUpdateActions } = await this.talonOneCouponAdapter.fetchCouponEffectsAndUpdateActionsById(ctCart.id, ctCart, couponEffects.coupons);
            // if (talonOneUpdateActions?.updateActions) {
            //     updateActions.push(...talonOneUpdateActions.updateActions);
            // }

            // await this.couponService.addCouponInformation(updateActions, cartId, talonOneUpdateActions?.couponsInformation);

            // if (updateActions.length > 0) {
            //     const updatedCartFinal = await CommercetoolsCartClient.updateCart(
            //         ctCart.id,
            //         ctCart.version,
            //         updateActions
            //     );
            //     ctCart = updatedCartFinal;
            // }

            // if (permanentlyInvalidRejectedCoupons.length > 0) {
            //     throw createStandardizedError({
            //         statusCode: HTTP_STATUSES.BAD_REQUEST,
            //         statusMessage: 'Some coupons were rejected during processing.',
            //         data: permanentlyInvalidRejectedCoupons,
            //     }, 'createOrder');
            // }

            console.log('JSON.stringify(selectedLineItems)', JSON.stringify(selectedLineItems)); // Have only 2/3 now but still placing 3 items.
            const orderDraft = {
                orderNumber,
                version: ctCart.version,
                // cart: {
                //     typeId: 'cart',
                //     id: ctCart.id,
                // },
                lineItems: selectedLineItems.map((lineItem) => ({
                    productId: lineItem.productId,
                    variantId: lineItem.variant.id,
                    quantity: lineItem.quantity,
                    supplyChannel: lineItem.supplyChannel?.id,
                    distributionChannel: lineItem.distributionChannel?.id,
                    custom: lineItem.custom,
                })),
                orderState: ORDER_STATES.OPEN,
                shipmentState: SHIPMENT_STATES.PENDING,
                paymentState: PAYMENT_STATES.PENDING,
                state: {
                    typeId: 'state',
                    key: STATE_ORDER_KEYS.ORDER_CREATED,
                },
                custom: ctCart.custom,
            };
            const order = await commercetoolsOrderClient.createOrderWithCustomDraft(orderDraft);
            return order;

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

            // const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(ctCart)
            // const cartWithUpdatedPrice = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)

            await this.updateStockAllocation(ctCart);
            // const order = await commercetoolsOrderClient.createOrderFromCart(orderNumber, ctCart, tsmSaveOrder);
            await this.createOrderAdditional(order, client);
            return order;
            // return { ...order, hasChanged: cartWithUpdatedPrice.compared };
        } catch (error: any) {
            logger.info(`CartService.createOrder.error`, error);
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'createOrder');
        }
    };

    /**
     * Creates an Order from only the "selected=true" line items in an existing cart,
     * removing all unselected line items first. The cart becomes "ordered" afterwards,
     * so it cannot be updated. If we want the unselected items again later, we will
     * create a new cart (example method at bottom).
     */
    public createOrderWithSelectedOnly = async (
        accessToken: string,
        ctCartId: string,
    ): Promise<Order> => {
        try {
            // 1. Fetch the existing Cart from Commercetools
            let cart = await this.getCtCartById(accessToken, ctCartId);

            // 2. Determine which items are selected vs. unselected
            const selectedLineItems = cart.lineItems.filter(
                (li) => li.custom?.fields?.selected === true
            );
            if (selectedLineItems.length === 0) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'No selected items in the cart. Please select items before placing an order.',
                }, 'createOrderWithSelectedOnly');
            }

            const unselectedLineItems = cart.lineItems.filter(
                (li) => li.custom?.fields?.selected !== true
            );

            // 3. Remove unselected line items while cart is still Active
            if (unselectedLineItems.length > 0) {
                const removeActions: CartUpdateAction[] = unselectedLineItems.map((lineItem) => ({
                    action: 'removeLineItem',
                    lineItemId: lineItem.id,
                }));

                cart = await CommercetoolsCartClient.updateCart(
                    cart.id,
                    cart.version,
                    removeActions
                );

                // Refresh cart to get the new version
                cart = await this.getCtCartById(accessToken, ctCartId);
            }

            // 4. Create the Order from the pruned cart
            //    This immediately sets cart.cartState = 'Ordered',
            //    making further updates impossible on this same cart.
            const orderNumber = this.generateOrderNumber();
            const order = await commercetoolsOrderClient.createOrderFromCart(orderNumber, cart);

            // 5. Return the new Order; done. We do NOT try to re-add items, because the cart is no longer active.
            return order;

        } catch (error: any) {
            logger.info(`CartService.createOrderWithSelectedOnly.error`, error);
            if (error.status && error.message) {
                throw error;
            }
            throw createStandardizedError(error, 'createOrderWithSelectedOnly');
        }
    };

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
            logger.info(`CartService.checkout.error`, error);
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

            const filteredLineItems = commercetoolsMeCartClient.filterLineItems(ctCart.lineItems, selectedOnly);
            const cartToProcess = { ...ctCart, lineItems: filteredLineItems };

            const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(cartToProcess)
            const cartWithUpdatedPrice = await commercetoolsMeCartClient.updateCartChangeDataToCommerceTools(ctCartWithChanged)

            // 2) Possibly auto-remove invalid coupons
            let cartAfterAutoRemove: Cart = cartWithUpdatedPrice;
            let permanentlyInvalidRejectedCoupons: Array<{ code: string; reason: string }> = [];
            if (includeCoupons) {
                const {
                    updatedCart,
                    permanentlyInvalidRejectedCoupons: invalidCoupons
                } = await this.couponService.autoRemoveInvalidCouponsAndReturnOnce(cartWithUpdatedPrice);
                cartAfterAutoRemove = updatedCart;
                permanentlyInvalidRejectedCoupons = invalidCoupons;
            }

            // 3) Map to ICart
            const iCartWithBenefit: ICart = await commercetoolsMeCartClient.getCartWithBenefit(cartAfterAutoRemove);
            let couponEffects: ICoupon = {
                coupons: {
                    acceptedCoupons: [],
                    rejectedCoupons: [],
                },
            };
            if (includeCoupons) {
                couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCartId(cartAfterAutoRemove.id, cartAfterAutoRemove.lineItems);
            }

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
            const tsmOrder = new TsmOrderModel({ ctCart: cart, config, orderNumber })
            const tsmOrderPayload = tsmOrder.toPayload()

            logger.info(`tsmOrderPayload: ${JSON.stringify(tsmOrderPayload)}`)
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