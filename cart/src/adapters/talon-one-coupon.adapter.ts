// cart/src/adapters/ct-t1.adapter.ts

import {
    Cart,
    CartAddCustomLineItemAction,
    CartAddLineItemAction,
    CartChangeCustomLineItemMoneyAction,
    CartRemoveCustomLineItemAction,
    CartUpdateAction,
} from '@commercetools/platform-sdk';
import { readConfiguration } from '../utils/config.utils';
import { COUPON_CUSTOM_EFFECT } from '../constants/cart.constant';
import { talonOneIntegrationAdapter } from './talon-one.adapter';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { Coupon, CouponCustomEffect, ICoupon, ProcessedCouponEffect } from '../interfaces/coupon.interface';

export class TalonOneCouponAdapter {
    private ctpAddCustomCouponLineItemPrefix: string;
    private ctpTaxCategoryId: string;

    constructor() {
        this.ctpAddCustomCouponLineItemPrefix = readConfiguration().ctpAddCustomCouponLineItemPrefix;
        this.ctpTaxCategoryId = readConfiguration().ctpTaxCategoryId;
    }

    public mapICoupons(acceptedCoupons: Coupon[], rejectedCoupons: Coupon[]): ICoupon {
        return {
            coupons: {
                acceptedCoupons,
                rejectedCoupons,
            },
        };
    }

    private parseCouponCustomEffectPayload(payload: any): CouponCustomEffect | null {
        if (!payload) {
            return null;
        }
        return {
            status: payload.status === 'true',
            discount_price: payload.discount_price ? parseFloat(payload.discount_price) : 0,
            discount_percentage: payload.discount_percentage ? parseFloat(payload.discount_percentage) : 0,
            discount_code: payload.discount_code,
            other_payment_code: payload.other_payment_code,
            name_th: payload.name_th,
            name_en: payload.name_en,
            marketing_name_th: payload.marketing_name_th,
            marketing_name_en: payload.marketing_name_en,
            coupon_short_detail_th: payload.coupon_short_detail_th,
            coupon_short_detail_en: payload.coupon_short_detail_en,
            term_condition_th: payload.term_condition_th,
            term_condition_en: payload.term_condition_en,
        };
    }

    /**
     * Merge effect data into an array of coupons.
     *
     * @param coupons - The array of coupons to enhance.
     * @param couponCustomEffectData - Map of coupon code => custom effect details.
     * @returns A new array of coupons with customEffect if available.
     */
    private mergeCouponsWithCustomEffects(
        coupons: Coupon[],
        couponCustomEffectData: { [key: string]: CouponCustomEffect }
    ): Coupon[] {
        return coupons.map(c => {
            const { code } = c;
            const customEffect = couponCustomEffectData[code];
            return customEffect ? { ...c, customEffect } : c;
        });
    }

    public processCouponEffectsOld(effects: any[]): ProcessedCouponEffect {
        const couponCodes: string[] = [];
        const acceptedCouponCodes: string[] = [];
        const rejectedCouponCodes: string[] = [];
        const acceptedCoupons: Coupon[] = [];
        const rejectedCoupons: Coupon[] = [];
        const customEffects: any[] = [];
        const couponIdToCode: { [key: number]: string } = {};
        const couponIdToEffects: { [key: number]: CouponCustomEffect[] } = {};
        const couponCustomEffectData: { [key: string]: CouponCustomEffect } = {};

        effects.forEach(effect => {
            const { effectType, props, triggeredByCoupon } = effect;

            if (triggeredByCoupon) {
                couponIdToEffects[triggeredByCoupon] = couponIdToEffects[triggeredByCoupon] || [];
                couponIdToEffects[triggeredByCoupon].push(effect);
            }

            switch (effectType) {
                case 'acceptCoupon':
                    couponCodes.push(props.value);
                    acceptedCouponCodes.push(props.value);

                    acceptedCoupons.push({
                        code: props.value,
                    });

                    if (triggeredByCoupon) {
                        couponIdToCode[triggeredByCoupon] = props.value;
                    }
                    break;

                case 'rejectCoupon':
                    couponCodes.push(props.value);
                    rejectedCouponCodes.push(props.value);

                    rejectedCoupons.push({
                        code: props.value,
                        reason: props.rejectionReason,
                    });
                    break;

                case 'customEffect':
                    if (props.name === COUPON_CUSTOM_EFFECT) {
                        const couponCode = triggeredByCoupon ? couponIdToCode[triggeredByCoupon] : undefined;
                        customEffects.push({ couponCode, props });

                        if (couponCode) {
                            const parsedPayload = this.parseCouponCustomEffectPayload(props.payload);

                            couponCustomEffectData[couponCode] = {
                                ...couponCustomEffectData[couponCode],
                                ...parsedPayload,
                            };
                        }
                    }
                    break;

                default:
                    // do nothing

                    break;
            }
        });

        const acceptedCouponsWithCustomEffects = this.mergeCouponsWithCustomEffects(
            acceptedCoupons,
            couponCustomEffectData
        );

        const rejectedCouponsWithCustomEffects = this.mergeCouponsWithCustomEffects(
            rejectedCoupons,
            couponCustomEffectData
        );

        const hasCoupons = couponCodes.length > 0;
        const iCoupons = this.mapICoupons(acceptedCouponsWithCustomEffects, rejectedCouponsWithCustomEffects);

        return {
            hasCoupons,
            iCoupons,
            couponCodes,
            acceptedCouponCodes,
            rejectedCouponCodes,
            acceptedCouponsWithCustomEffects,
            rejectedCouponsWithCustomEffects,
            acceptedCoupons,
            rejectedCoupons,
            customEffects,
            couponIdToCode,
            couponIdToEffects,
        };
    }

    public buildCouponActionsAndCouponsInformationOld(
        ctCart: Cart,
        processedEffects: ProcessedCouponEffect,
    ): { updateActions: CartUpdateAction[]; couponsInformation: any[] } {
        const updateActions: CartUpdateAction[] = [];
        const { acceptedCoupons, couponIdToCode, couponIdToEffects } = processedEffects;

        // Keep track of coupons that have custom line items
        const couponsInformation: any[] = [];

        // Process accepted coupons and their associated effects
        for (const triggeredByCoupon in couponIdToCode) {
            const couponCode = couponIdToCode[triggeredByCoupon];
            const associatedEffects = couponIdToEffects[triggeredByCoupon];

            associatedEffects.forEach(effect => {
                const { effectType, props } = effect;

                switch (effectType) {
                    case 'setDiscount':
                        this.handleSetDiscountEffect(ctCart, updateActions, couponCode, props);
                        break;

                    case 'addFreeItem':
                        this.handleAddFreeItemEffect(updateActions, props);
                        break;

                    case 'customEffect':
                        couponsInformation.push(this.prepareCouponInformation(couponCode, props));
                        break;

                    default:
                        // do nothing

                        break;
                }
            });
        }

        // Remove custom line items for rejected or missing coupons
        this.buildRemoveCouponActions(ctCart, updateActions, acceptedCoupons);

        return { updateActions, couponsInformation };
    }

    private buildRemoveCouponActions(
        ctCart: Cart,
        updateActions: CartUpdateAction[],
        acceptedCoupons: Coupon[]
    ): void {
        const applyCoupons = acceptedCoupons?.map((coupon: { code: string }) => coupon.code) || [];

        // Get all custom line items that are coupon discounts
        const couponCustomLineItems = ctCart.customLineItems.filter((item: any) =>
            item.slug.startsWith(this.ctpAddCustomCouponLineItemPrefix)
        );

        // Build a set of accepted coupon slugs
        const acceptedCouponSlugs = new Set(
            applyCoupons.map(code => `${this.ctpAddCustomCouponLineItemPrefix}${code}`)
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

    public processCouponEffects(effects: any[]): {
        updateActions: CartUpdateAction[];
        acceptedCoupons: Coupon[];
        rejectedCoupons: Coupon[];
        customEffects: any[];
        couponIdToCode: { [key: number]: string };
        couponIdToEffects: { [key: number]: any[] };
        applyCoupons: { code: string; }[];
    } {
        const updateActions: CartUpdateAction[] = [];
        const acceptedCoupons: Coupon[] = [];
        const rejectedCoupons: Coupon[] = [];
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

                default:
                    // do nothing

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
        ctCart: Cart,
        processedEffects: {
            acceptedCoupons: Coupon[];
            rejectedCoupons: Coupon[];
            couponIdToCode: { [key: number]: string };
            couponIdToEffects: { [key: number]: any[] };
        }
    ): { updateActions: CartUpdateAction[]; couponsInformation: any[] } {
        const updateActions: CartUpdateAction[] = [];
        const { acceptedCoupons, couponIdToCode, couponIdToEffects } = processedEffects;

        // Keep track of coupons that have custom line items
        const couponsWithCustomLineItems = new Set<string>();
        const couponsInformation: any[] = [];

        // Process accepted coupons and their associated effects
        for (const triggeredByCoupon in couponIdToCode) {
            const couponCode = couponIdToCode[triggeredByCoupon];
            const associatedEffects = couponIdToEffects[triggeredByCoupon];

            associatedEffects.forEach(effect => {
                const { effectType, props } = effect;

                switch (effectType) {
                    case 'setDiscount':
                        this.handleSetDiscountEffect(ctCart, updateActions, couponCode, props);
                        couponsWithCustomLineItems.add(couponCode);
                        break;

                    case 'addFreeItem':
                        this.handleAddFreeItemEffect(updateActions, props);
                        break;

                    case 'customEffect':
                        couponsInformation.push(this.prepareCouponInformation(couponCode, props));
                        break;

                    default:
                        // do nothing

                        break;
                }
            });
        }

        const applyCoupons = acceptedCoupons?.map((coupon: any) => coupon) ?? [];

        // Remove custom line items for rejected or missing coupons
        this.removeInvalidCustomLineItems(ctCart, updateActions, couponsWithCustomLineItems, applyCoupons);

        return { updateActions, couponsInformation };
    }

    private handleSetDiscountEffect(
        ctCart: Cart,
        updateActions: CartUpdateAction[],
        couponCode: string,
        props: any
    ): void {
        const slug = `${this.ctpAddCustomCouponLineItemPrefix}${couponCode}`;
        const existingCustomLineItem = ctCart.customLineItems.find(
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
                    currencyCode: ctCart.totalPrice.currencyCode,
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
                        currencyCode: ctCart.totalPrice.currencyCode,
                    },
                };
                updateActions.push(updateCustomLineItem);
            } else {
                logger.info(`Custom line item with slug "${slug}" already has the correct discount amount.`);
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
        ctCart: Cart,
        updateActions: CartUpdateAction[],
        couponsWithCustomLineItems: Set<string>,
        acceptedCoupons: string[]
    ): void {
        // Get all custom line items that are coupon discounts
        const couponCustomLineItems = ctCart.customLineItems.filter((item: any) =>
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

    async getCouponEffectsByCtCartId(id: any, lineItems: any): Promise<ICoupon> {
        const defaultCoupons: ICoupon = { coupons: { acceptedCoupons: [], rejectedCoupons: [] } };

        // Early return if no line items are provided
        if (lineItems.length <= 0) {
            return defaultCoupons;
        }

        try {
            const { effects: talonEffects } = await talonOneIntegrationAdapter.getCustomerSession(id);

            const { applyCoupons: acceptedCoupons, rejectedCoupons } = this.processCouponEffects(talonEffects);

            return { coupons: { acceptedCoupons, rejectedCoupons } };
        } catch (error: any) {
            logger.error("cartService.checkout.talonOneCouponAdapter.getCouponEffectsByCtCartId.error: ", error);

            return defaultCoupons;
        }
    }

    async fetchCouponEffectsAndUpdateActionsById(profileId: string, ctCart: Cart, couponsEffects: any) {
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
                ctCartData: ctCart,
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
            const talonOneUpdateActions = this.buildCouponActions(ctCart, processedCouponEffects);

            // Step 6: Update acceptedCoupons and rejectedCoupons
            couponsEffects.acceptedCoupons = processedCouponEffects.applyCoupons;
            couponsEffects.rejectedCoupons = processedCouponEffects.rejectedCoupons;

            return { couponsEffects, talonOneUpdateActions };
        } catch (error) {
            logger.error("cartService.checkout.talonOneCouponAdapter.fetchCouponEffectsAndUpdateActionsById.error: ", error);
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                errorCode: "CART_FETCH_EFFECTS_COUPONS_CT_FAILED",
                statusMessage: "An unexpected error occurred while processing the coupon effects."
            };
        }
    }

    private prepareCouponInformation(couponCode: string, props: any): any {
        return {
            marketingName: {
                en: props.payload.marketing_name_en,
                th: props.payload.marketing_name_th,
            },
            couponName: props.payload.name_en,
            couponCode: couponCode,
            discountCode: props.payload.discount_code,
            otherPaymentCode: props.payload.other_payment_code,
            discountPrice: Number(props.payload.discount_price) || 0,
            discountPercentage: Number(props.payload.discount_percentage) || 0,
        };
    }
}
