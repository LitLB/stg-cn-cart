// cart/src/adapters/ct-t1.adapter.ts

import {
    CartAddCustomLineItemAction,
    CartAddLineItemAction,
    CartChangeCustomLineItemMoneyAction,
    CartRemoveCustomLineItemAction,
    CartUpdateAction,
} from '@commercetools/platform-sdk';
import { readConfiguration } from '../utils/config.utils';
import { COUPON_CUSTOM_EFFECT } from '../constants/cart.constant';
import { talonOneIntegrationAdapter } from './talon-one.adapter';
import { HTTP_STATUSES } from '../constants/http.constant';
import { logger } from '../utils/logger.utils';

export class TalonOneCouponAdapter {
    private ctpAddCustomCouponLineItemPrefix: string;
    private ctpTaxCategoryId: string;

    constructor() {
        this.ctpAddCustomCouponLineItemPrefix = readConfiguration().ctpAddCustomCouponLineItemPrefix;
        this.ctpTaxCategoryId = readConfiguration().ctpTaxCategoryId;
    }

    public processCouponEffects(effects: any[]): {
        updateActions: CartUpdateAction[];
        acceptedCoupons: string[];
        rejectedCoupons: { code: string; reason: string }[];
        customEffects: any[];
        couponIdToCode: { [key: number]: string };
        couponIdToEffects: { [key: number]: any[] };
        applyCoupons: { code: string; }[];
    } {
        const updateActions: CartUpdateAction[] = [];
        const acceptedCoupons: string[] = [];
        const rejectedCoupons: { code: string; reason: string }[] = [];
        const customEffects: any[] = [];
        const couponIdToCode: { [key: number]: string } = {};
        const couponIdToEffects: { [key: number]: any[] } = {};
        const applyCoupons: { code: string; }[] = [];

        // Process effects to build mappings
        effects.forEach(effect => {
            const { effectType, props, triggeredByCoupon } = effect;

            if (triggeredByCoupon) {
                if (!couponIdToEffects[triggeredByCoupon]) {
                    couponIdToEffects[triggeredByCoupon] = [];
                }
                couponIdToEffects[triggeredByCoupon].push(effect);
            }

            switch (effectType) {
                case 'acceptCoupon':
                    acceptedCoupons.push(props.value);
                    applyCoupons.push({
                        code: props.value,
                    });
                    if (triggeredByCoupon) {
                        couponIdToCode[triggeredByCoupon] = props.value;
                    }
                    break;

                case 'rejectCoupon':
                    rejectedCoupons.push({
                        code: props.value,
                        reason: props.rejectionReason,
                    });
                    break;

                case 'customEffect':
                    if (props.name === COUPON_CUSTOM_EFFECT) {
                        customEffects.push({
                            couponCode: couponIdToCode[triggeredByCoupon],
                            props,
                        });
                    }
                    break;

                // Handle other effect types if needed
                default:
                    break;
            }
        });

        return {
            updateActions,
            acceptedCoupons,
            rejectedCoupons,
            customEffects,
            couponIdToCode,
            couponIdToEffects,
            applyCoupons,
        };
    }

    public buildCouponActions(
        cart: any,
        processedEffects: {
            acceptedCoupons: string[];
            rejectedCoupons: { code: string; reason: string }[];
            couponIdToCode: { [key: number]: string };
            couponIdToEffects: { [key: number]: any[] };
        }
    ): CartUpdateAction[] {
        const updateActions: CartUpdateAction[] = [];

        const { acceptedCoupons, rejectedCoupons, couponIdToCode, couponIdToEffects } = processedEffects;

        // Keep track of coupons that have custom line items
        const couponsWithCustomLineItems = new Set<string>();

        // Process accepted coupons and their associated effects
        for (const triggeredByCoupon in couponIdToCode) {
            const couponCode = couponIdToCode[triggeredByCoupon];
            const associatedEffects = couponIdToEffects[triggeredByCoupon];

            associatedEffects.forEach(effect => {
                const { effectType, props } = effect;

                switch (effectType) {
                    case 'setDiscount':
                        this.handleSetDiscountEffect(cart, updateActions, couponCode, props);
                        couponsWithCustomLineItems.add(couponCode);
                        break;

                    case 'addFreeItem':
                        this.handleAddFreeItemEffect(updateActions, props);
                        break;

                    // Handle other effect types if needed
                    default:
                        break;
                }
            });
        }

        // Remove custom line items for rejected or missing coupons
        this.removeInvalidCustomLineItems(cart, updateActions, couponsWithCustomLineItems, acceptedCoupons);

        return updateActions;
    }

    private handleSetDiscountEffect(
        cart: any,
        updateActions: CartUpdateAction[],
        couponCode: string,
        props: any
    ): void {
        const slug = `${this.ctpAddCustomCouponLineItemPrefix}${couponCode}`;
        const existingCustomLineItem = cart.customLineItems.find(
            (item: any) => item.slug === slug
        );

        const discountAmount = -Math.round(props.value * 100);

        if (!existingCustomLineItem) {
            // Add new custom line item
            const customLineItem: CartAddCustomLineItemAction = {
                action: 'addCustomLineItem',
                name: { en: `${this.ctpAddCustomCouponLineItemPrefix}${couponCode}` },
                money: {
                    centAmount: discountAmount,
                    currencyCode: cart.totalPrice.currencyCode,
                },
                quantity: 1,
                slug,
                taxCategory: {
                    typeId: 'tax-category',
                    id: this.ctpTaxCategoryId,
                },
            };
            updateActions.push(customLineItem);
        } else {
            // Update existing custom line item if discount amount has changed
            const existingDiscountAmount = existingCustomLineItem.money.centAmount;

            if (existingDiscountAmount !== discountAmount) {
                const updateCustomLineItem: CartChangeCustomLineItemMoneyAction = {
                    action: 'changeCustomLineItemMoney',
                    customLineItemId: existingCustomLineItem.id,
                    money: {
                        centAmount: discountAmount,
                        currencyCode: cart.totalPrice.currencyCode,
                    },
                };
                updateActions.push(updateCustomLineItem);
            } else {
                console.info(`Custom line item with slug "${slug}" already has the correct discount amount.`);
            }
        }
    }

    private handleAddFreeItemEffect(
        updateActions: CartUpdateAction[],
        props: any
    ): void {
        const addLineItemAction: CartAddLineItemAction = {
            action: 'addLineItem',
            productId: props.productId,
            variantId: props.variantId,
            quantity: props.quantity || 1,
            externalPrice: {
                currencyCode: props.currencyCode, // Ensure currencyCode is provided in props or use a default
                centAmount: 0,
            },
            custom: {
                type: {
                    typeId: 'type',
                    key: 'lineItemCustomType',
                },
                fields: {
                    isFreeItem: true,
                },
            },
        };
        updateActions.push(addLineItemAction);
    }

    private removeInvalidCustomLineItems(
        cart: any,
        updateActions: CartUpdateAction[],
        couponsWithCustomLineItems: Set<string>,
        acceptedCoupons: string[]
    ): void {
        // Get all custom line items that are coupon discounts
        const couponCustomLineItems = cart.customLineItems.filter((item: any) =>
            item.slug.startsWith(this.ctpAddCustomCouponLineItemPrefix)
        );

        // Build a set of accepted coupon slugs
        const acceptedCouponSlugs = new Set(
            acceptedCoupons.map(code => `${this.ctpAddCustomCouponLineItemPrefix}${code}`)
        );

        // For each coupon custom line item, if it's not in the accepted coupons, remove it
        couponCustomLineItems.forEach((item: any) => {
            if (!acceptedCouponSlugs.has(item.slug)) {
                const removeAction: CartRemoveCustomLineItemAction = {
                    action: 'removeCustomLineItem',
                    customLineItemId: item.id,
                };
                updateActions.push(removeAction);
            }
        });
    }

    async fetchCouponsAndUpdateActionsById(profileId: string, cart: any, couponsEffects: any) {
        try {
            if (couponsEffects.acceptedCoupons.length <= 0) {
                return { couponsEffects };
            }

            // Step 1: Extract coupon codes
            let couponCodes: string[] = couponsEffects.acceptedCoupons.map((coupon: { code: string }) => coupon.code);

            // Merge and deduplicate coupon codes from couponsEffects rejectedCoupons
            if (couponsEffects?.rejectedCoupons?.length > 0) {
                const rejectedCouponCodes: string[] = couponsEffects.rejectedCoupons.map((coupon: { code: string }) => coupon.code);
                couponCodes = Array.from(new Set([...couponCodes, ...rejectedCouponCodes]));
            }
           
            // Step 2: Build the customer session payload
            const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                profileId,
                ctCartData: cart,
                couponCodes
            });
        
            let updatedCustomerSession;
            
            try {
                // Step 3: Update the customer session with TalonOne
                updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(profileId, customerSessionPayload);
            } catch (error: any) {
                logger.info('TalonOne updateCustomerSession error', error);
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    errorCode: "CHECKOUT_CT_FAILED",
                    statusMessage: `An error occurred while updating the customer session in TalonOne.`
                };
            }
        
            // Step 4: Process coupon effects
            const talonEffects = updatedCustomerSession.effects;
            const processedCouponEffects = this.processCouponEffects(talonEffects);
        
            // Step 5: Build coupon actions
            const talonOneUpdateActions = this.buildCouponActions(cart, processedCouponEffects);
        
            // Step 6: Update acceptedCoupons and rejectedCoupons
            couponsEffects.acceptedCoupons = processedCouponEffects.applyCoupons;
            couponsEffects.rejectedCoupons = processedCouponEffects.rejectedCoupons;
        
            return { couponsEffects, talonOneUpdateActions };
        } catch (error) {
            logger.error("cartService.checkout.talonOneCouponAdapter.fetchCouponsAndUpdateActionsById.error: ", error);
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                errorCode: "CART_FETCH_EFFECTS_COUPONS_CT_FAILED",
                statusMessage: "An unexpected error occurred while processing the coupon effects."
            };
        }
    }
}
