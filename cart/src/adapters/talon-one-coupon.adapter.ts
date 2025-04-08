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

    public processCouponEffects(effects: any[], cartInfoForCouponValidation: any): {
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


        const { validEffects } = this.getValidCouponEffects(effects, cartInfoForCouponValidation)
        // Process effects to build mappings
        validEffects.forEach(effect => {
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

    public processCouponEffectsV2(effects: any[]): ProcessedCouponEffect {
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
        const mapCouponCodeToLineItemId: any = {}
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
                        mapCouponCodeToLineItemId[couponCode] = props?.lineItemId || null
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
        this.removeInvalidCustomLineItems(ctCart, updateActions, applyCoupons, mapCouponCodeToLineItemId);

        return { updateActions, couponsInformation };
    }

    // public buildCouponActionsV2(
    //     ctCart: Cart,
    //     processedEffects: {
    //         acceptedCoupons: Coupon[];
    //         rejectedCoupons: Coupon[];
    //         couponIdToCode: { [key: number]: string };
    //         couponIdToEffects: { [key: number]: any[] };
    //     }
    // ): { updateActions: CartUpdateAction[]; couponsInformation: any[] } {
    //     const updateActions: CartUpdateAction[] = [];
    //     const { acceptedCoupons, couponIdToCode, couponIdToEffects } = processedEffects;

    //     // Keep track of coupons that have custom line items
    //     const couponsInformation: any[] = [];

    //     // Process accepted coupons and their associated effects
    //     for (const triggeredByCoupon in couponIdToCode) {
    //         const couponCode = couponIdToCode[triggeredByCoupon];
    //         const associatedEffects = couponIdToEffects[triggeredByCoupon];

    //         associatedEffects.forEach(effect => {
    //             const { effectType, props } = effect;

    //             switch (effectType) {
    //                 case 'setDiscount':
    //                     this.handleSetDiscountEffect(ctCart, updateActions, couponCode, props);
    //                     break;

    //                 case 'addFreeItem':
    //                     this.handleAddFreeItemEffect(updateActions, props);
    //                     break;

    //                 case 'customEffect':
    //                     couponsInformation.push(this.prepareCouponInformation(couponCode, props));
    //                     break;

    //                 default:
    //                     // do nothing

    //                     break;
    //             }
    //         });
    //     }

    //     // Remove custom line items for rejected or missing coupons
    //     this.removeInvalidCustomLineItemsV2(ctCart, updateActions, acceptedCoupons);

    //     return { updateActions, couponsInformation };
    // }

    private removeInvalidCustomLineItems(
        ctCart: Cart,
        updateActions: CartUpdateAction[],
        acceptedCoupons: string[],
        mapCouponCodeToLineItemId: any
    ): void {
        // Get all custom line items that are coupon discounts
        const couponCustomLineItems = ctCart.customLineItems.filter((item: any) =>
            item.slug.startsWith(this.ctpAddCustomCouponLineItemPrefix)
        );

        // Build a set of accepted coupon slugs
        const acceptedCouponSlugs = new Set(
            acceptedCoupons.map(code => {
                let slug = `${this.ctpAddCustomCouponLineItemPrefix}${code}`
                const lineItemId = mapCouponCodeToLineItemId?.[code]
                if (lineItemId) {
                    slug = `${this.ctpAddCustomCouponLineItemPrefix}${code}-${lineItemId}`
                }
                return slug
            })
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

    private removeInvalidCustomLineItemsV2(
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

    private handleSetDiscountEffect(
        ctCart: Cart,
        updateActions: CartUpdateAction[],
        couponCode: string,
        props: any
    ): void {
        let slug = `${this.ctpAddCustomCouponLineItemPrefix}${couponCode}`;
        if (props?.line_item_id) {
            slug = `${this.ctpAddCustomCouponLineItemPrefix}${couponCode}-${props.line_item_id}`;
        }
        const existingCustomLineItem = ctCart.customLineItems.find(
            (item: any) => item.slug === slug
        );

        const discountAmount = -Math.round(props.value * 100);

        if (!existingCustomLineItem) {
            // Add new custom line item
            const customLineItem: CartAddCustomLineItemAction = {
                action: 'addCustomLineItem',
                name: { en: slug },
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

    async getCouponEffectsByCtCart(ctCart: any, cartInfoForCouponValidation: any): Promise<ICoupon> {
        const defaultCoupons: ICoupon = { coupons: { acceptedCoupons: [], rejectedCoupons: [] } };
        const id = ctCart.id
        const lineItems = ctCart.lineItems
        // Early return if no line items are provided
        if (lineItems.length <= 0) {
            return defaultCoupons;
        }

        try {
            const { effects: talonEffects } = await talonOneIntegrationAdapter.getCustomerSession(id);
            const { applyCoupons: acceptedCoupons, rejectedCoupons } = this.processCouponEffects(talonEffects, cartInfoForCouponValidation);

            return { coupons: { acceptedCoupons, rejectedCoupons } };
        } catch (error: any) {
            logger.error("cartService.checkout.talonOneCouponAdapter.getCouponEffectsByCtCart.error: ", error);

            return defaultCoupons;
        }
    }

    async getCouponEffectsByCtCartIdV2(id: any, lineItems: any): Promise<ICoupon> {
        const defaultCoupons: ICoupon = { coupons: { acceptedCoupons: [], rejectedCoupons: [] } };

        // Early return if no line items are provided
        if (lineItems.length <= 0) {
            return defaultCoupons;
        }

        try {
            const { effects: talonEffects } = await talonOneIntegrationAdapter.getCustomerSession(id);

            const processCouponEffects = this.processCouponEffectsV2(talonEffects);
            console.log('processCouponEffects', processCouponEffects);

            return { coupons: { acceptedCoupons: processCouponEffects.acceptedCoupons, rejectedCoupons: processCouponEffects.rejectedCoupons } };
        } catch (error: any) {
            logger.error("cartService.checkout.talonOneCouponAdapter.getCouponEffectsByCtCartId.error: ", error);

            return defaultCoupons;
        }
    }

    async fetchCouponEffectsAndUpdateActionsByCtCart(ctCart: Cart, cartInfoForCouponValidation: any, couponsEffects: any) {
        try {
            if (couponsEffects.acceptedCoupons.length <= 0) {
                return { couponsEffects };
            }

            const cartId = ctCart.id

            // Step 1: Extract coupon codes
            let couponCodes: string[] = couponsEffects.acceptedCoupons.map((coupon: { code: string }) => coupon.code);

            // Merge and deduplicate coupon codes from couponsEffects rejectedCoupons
            if (couponsEffects?.rejectedCoupons?.length > 0) {
                const rejectedCouponCodes: string[] = couponsEffects.rejectedCoupons.map((coupon: { code: string }) => coupon.code);
                couponCodes = Array.from(new Set([...couponCodes, ...rejectedCouponCodes]));
            }

            // Step 2: Build the customer session payload
            const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                ctCartData: ctCart,
                couponCodes
            });

            let updatedCustomerSession;

            try {
                // Step 3: Update the customer session with TalonOne
                updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(cartId, customerSessionPayload);
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
            const processedCouponEffects = this.processCouponEffects(talonEffects, cartInfoForCouponValidation);

            // Step 5: Build coupon actions
            const talonOneUpdateActions = this.buildCouponActions(ctCart, processedCouponEffects);

            // Step 6: Update acceptedCoupons and rejectedCoupons
            couponsEffects.acceptedCoupons = processedCouponEffects.acceptedCoupons;
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
            couponCode: couponCode,
            discountPrice: Number(props.payload.discount_price) || 0,
            discountPercentage: Number(props.payload.discount_percentage) || 0,
            discountCode: props.payload.discount_code,
            otherPaymentCode: props.payload.other_payment_code,
            couponName: {
                th: props.payload.name_th || '',
                en: props.payload.name_th || '',
            },
            marketingName: {
                en: props.payload.marketing_name_en,
                th: props.payload.marketing_name_th,
            },
            couponShortDetail: {
                th: props.payload.coupon_short_detail_th || '',
                en: props.payload.coupon_short_detail_en || '',
            },
            couponImage: props.payload.coupon_image || '',
            termCondition: {
                th: props.payload.term_condition_th || '',
                en: props.payload.term_condition_en || '',
            },
            maximumDiscount: props.payload.maximum_discount ?? 0,
            minimumPurchase: props.payload.minimum_purchase ?? 0,
            allowStacking: props.payload.allow_stacking,
            allowedCampaignGroups: (props.payload.allowed_campaign_groups ?? []).filter((v: any) => v !== 'null'),
            loyaltyGroups: (props.payload.loyalty_groups ?? []).filter((v: any) => v !== 'null'),
            customerTypes: (props.payload.customer_types ?? []).filter((v: any) => v !== 'null'),
            allowedJourneys: (props.payload.allowed_journeys ?? []).filter((v: any) => v !== 'null'),
            allowedProducts: (props.payload.allowed_products ?? []).filter((v: any) => v !== 'null'),
            excludedProducts: (props.payload.excluded_products ?? []).filter((v: any) => v !== 'null'),
            allowedSeries: (props.payload.allowed_series ?? []).filter((v: any) => v !== 'null'),
            excludedSeries: (props.payload.excluded_series ?? []).filter((v: any) => v !== 'null'),
            allowedBrands: (props.payload.allowed_brands ?? []).filter((v: any) => v !== 'null'),
            excludedBrands: (props.payload.excluded_brands ?? []).filter((v: any) => v !== 'null'),
            allowedCategories: (props.payload.allowed_categories ?? []).filter((v: any) => v !== 'null'),
            excludedCategories: (props.payload.excluded_categories ?? []).filter((v: any) => v !== 'null'),
            allowedPackages: (props.payload.allowed_packages ?? []).filter((v: any) => v !== 'null'),
            excludedPackages: (props.payload.excluded_packages ?? []).filter((v: any) => v !== 'null'),
            lineItemId: props.payload.line_item_id,
            calculatedDiscountPrice: props.payload.calculated_discount_price
        };
    }

    private getValidCouponEffects(effects: any[], cartInfoForCouponValidation?: any) {
        const isAcceptCouponEffect = (effect: any) => effect.effectType === 'acceptCoupon'
        const isCouponSetDiscount = (effect: any) => effect.effectType === 'setDiscount' && effect.triggeredByCoupon
        const isCouponCustomEffect = (effect: any) => effect.effectType === 'customEffect' && effect.props.name === COUPON_CUSTOM_EFFECT
        const acceptCouponEffects = effects.filter((effect: any) => isAcceptCouponEffect(effect))
        const setDiscountEffects = effects.filter((effect: any) => isCouponSetDiscount(effect))
        const couponCustomEffects = effects.filter((effect: any) => isCouponCustomEffect(effect))
        const otherEffects = effects.filter((effect: any) => !isAcceptCouponEffect(effect) && !isCouponSetDiscount(effect) && !isCouponCustomEffect(effect))

        const invalidCouponIds: any = []
        const mapCouponCodeToLineItemId: any = {}
        const couponAllowStackingValues: any = []
        const { campaignGroup, journey, totalPriceAfterCampaignDiscountInBaht, lineItems, customerType, loyaltyGroup } = cartInfoForCouponValidation

        for (const couponCustomEffect of couponCustomEffects) {
            const { triggeredByCoupon: couponId, props } = couponCustomEffect
            const couponAttribute = props.payload

            const {
                minimum_purchase: minimumPurchase = 0,
                allowed_campaign_groups: allowedCampaignGroups = [],
                allowed_journeys: allowedJourneys = [],
                customer_types: customerTypes = [],
                loyalty_groups: loyaltyGroups = [],
                allow_stacking: allowStacking
            } = couponAttribute || {};

            let {
                allowed_products: allowedProducts = [],
                excluded_products: excludedProducts = [],
                allowed_series: allowedSeries = [],
                excluded_series: excludedSeries = [],
                allowed_brands: allowedBrands = [],
                excluded_brands: excludedBrands = [],
                allowed_categories: allowedCategories = [],
                excluded_categories: excludedCategories = [],
                allowed_packages: allowedPackages = [],
                excluded_packages: excludedPackages = [],
            } = couponAttribute || {};

            if (totalPriceAfterCampaignDiscountInBaht < minimumPurchase) {
                invalidCouponIds.push(couponId)
                continue
            }

            if (!this.checkInAllowedList([campaignGroup], allowedCampaignGroups)) {
                invalidCouponIds.push(couponId)
                continue
            }

            if (!this.checkInAllowedList([journey], allowedJourneys)) {
                invalidCouponIds.push(couponId)
                continue
            }

            if (customerType !== null && !this.checkInAllowedList([customerType], customerTypes)) {
                invalidCouponIds.push(couponId)
                continue
            }

            if (loyaltyGroup !== null && !this.checkInAllowedList([loyaltyGroup], loyaltyGroups)) {
                invalidCouponIds.push(couponId)
                continue
            }

            allowedProducts = allowedProducts.filter((allowedProduct: any) => allowedProduct !== 'null')
            excludedProducts = excludedProducts.filter((excludedProduct: any) => excludedProduct !== 'null')
            allowedSeries = allowedSeries.filter((allowedSerie: any) => allowedSerie !== 'null')
            excludedSeries = excludedSeries.filter((excludedSeries: any) => excludedSeries !== 'null')
            allowedBrands = allowedBrands.filter((allowedBrand: any) => allowedBrand !== 'null')
            excludedBrands = excludedBrands.filter((excludedBrand: any) => excludedBrand !== 'null')
            allowedCategories = allowedCategories.filter((allowedCategory: any) => allowedCategory !== 'null')
            excludedCategories = excludedCategories.filter((excludedCategory: any) => excludedCategory !== 'null')
            allowedPackages = allowedPackages.filter((allowedPackage: any) => allowedPackage !== 'null')
            excludedPackages = excludedPackages.filter((excludedPackage: any) => excludedPackage !== 'null')

            const haveProductConditions = allowedProducts.length
                || excludedProducts.length
                || allowedSeries.length
                || excludedSeries.length
                || allowedBrands.length
                || excludedBrands.length
                || allowedCategories.length
                || excludedCategories.length
                || allowedPackages.length
                || excludedPackages.length
            const havePackageConditions = allowedPackages.length || excludedPackages.length

            const isByProductCoupon = haveProductConditions
            const isByBillCoupon = !isByProductCoupon
            if (isByProductCoupon) {
                const matchedLineItemProduct = lineItems.filter((lineItem: any) => lineItem.productType === 'main_product').find((lineItem: any) => {
                    const {
                        sku,
                        series,
                        category,
                        brand,
                    } = lineItem
                    const isAllowedProduct = this.checkInAllowedList([sku], allowedProducts)
                    const isAllowedSeries = this.checkInAllowedList([series], allowedSeries)
                    const isAllowedCategory = this.checkInAllowedList([category], allowedCategories)
                    const isAllowedBrand = this.checkInAllowedList([brand], allowedBrands)

                    const isNotInExcludedProduct = !this.checkInExcludedList([sku], excludedProducts)
                    const isNotInExcludedSeries = !this.checkInExcludedList([series], excludedSeries)
                    const isNotInExcludedCategory = !this.checkInExcludedList([category], excludedCategories)
                    const isNotInExcludedBrand = !this.checkInExcludedList([brand], excludedBrands)


                    return isAllowedProduct &&
                        isAllowedSeries &&
                        isAllowedCategory &&
                        isAllowedBrand &&
                        isNotInExcludedProduct &&
                        isNotInExcludedSeries &&
                        isNotInExcludedCategory &&
                        isNotInExcludedBrand
                })

                let matchedSomeLineItemPackage = true
                if (havePackageConditions) {
                    matchedSomeLineItemPackage = lineItems.filter((lineItem: any) => !lineItem.productType).some((lineItem: any) => {
                        const {
                            sku
                        } = lineItem
                        const isAllowedPackage = this.checkInAllowedList([sku], allowedPackages)
                        const isNotInExcludedPackage = !this.checkInExcludedList([sku], excludedPackages)
                        return isAllowedPackage &&
                            isNotInExcludedPackage
                    })
                }


                if (matchedLineItemProduct && matchedSomeLineItemPackage) {
                    mapCouponCodeToLineItemId[couponId] = matchedLineItemProduct.lineItemId
                    couponAllowStackingValues.push({
                        couponId,
                        allowStacking
                    })
                } else {
                    invalidCouponIds.push(couponId)
                    continue
                }
            }

            if (isByBillCoupon) {
                let matchedSomeLineItemPackage = true
                if (havePackageConditions) {
                    matchedSomeLineItemPackage = lineItems.filter((lineItem: any) => !lineItem.productType).some((lineItem: any) => {
                        const {
                            sku
                        } = lineItem
                        const isAllowedPackage = this.checkInAllowedList([sku], allowedPackages)
                        const isNotInExcludedPackage = !this.checkInExcludedList([sku], excludedPackages)
                        return isAllowedPackage &&
                            isNotInExcludedPackage
                    })
                }
                if (matchedSomeLineItemPackage) {
                    const matchedLineItemProduct = lineItems.filter((lineItem: any) => lineItem.productType === 'main_product')
                    mapCouponCodeToLineItemId[couponId] = journey === 'device_bundle_existing' ? matchedLineItemProduct.lineItemId : null
                    couponAllowStackingValues.push({
                        couponId,
                        allowStacking
                    })
                } else {
                    invalidCouponIds.push(couponId)
                    continue
                }
            }

        }

        let invalidStackingCouponIds = []
        const allSameAllowStackingValue = couponAllowStackingValues
            .every((couponAllowStackingValue: any) => couponAllowStackingValue.allowStacking === couponAllowStackingValues?.[0]?.allowStacking)
        if (!allSameAllowStackingValue) {
            invalidStackingCouponIds = couponAllowStackingValues
                .map((couponAllowStackingValue: any) => couponAllowStackingValue.couponId)
        }
        // ! Step#1 -> check customEffect
        // ! Step#2 -> if invalid then
        // ! Step#3.1 -> remove "acceptCoupon"
        const newAcceptCouponEffects = acceptCouponEffects
            .filter((acceptCouponEffect: any) => !invalidCouponIds.includes(acceptCouponEffect.triggeredByCoupon))
            .filter((acceptCouponEffect: any) => !invalidStackingCouponIds.includes(acceptCouponEffect.triggeredByCoupon))
        // ! Step#3.2 -> remove "setDiscount"
        const newSetDiscountEffects = setDiscountEffects
            .filter((setDiscountEffect: any) => !invalidCouponIds.includes(setDiscountEffect.triggeredByCoupon))
            .filter((setDiscountEffect: any) => !invalidStackingCouponIds.includes(setDiscountEffect.triggeredByCoupon))
            .map((setDiscountEffect: any) => {
                const lineItemId = mapCouponCodeToLineItemId[setDiscountEffect.triggeredByCoupon]
                const couponCustomEffect = couponCustomEffects.find((couponCustomEffect: any) => couponCustomEffect.triggeredByCoupon === setDiscountEffect.triggeredByCoupon)

                const {
                    discount_percentage: discountPercentage = 0,
                    maximum_discount: maximumDiscount = 0
                } = couponCustomEffect.props.payload || {}

                const hasPercentageDiscount = discountPercentage > 0;
                const hasMaxCap = maximumDiscount > 0;

                let calculatedDiscountPrice = setDiscountEffect.props.value

                if (hasPercentageDiscount) {
                    const rawDiscount = (totalPriceAfterCampaignDiscountInBaht * discountPercentage) / 100;
                    calculatedDiscountPrice = hasMaxCap ? Math.min(rawDiscount, maximumDiscount) : rawDiscount;
                }
                return {
                    ...setDiscountEffect,
                    props: {
                        ...setDiscountEffect.props,
                        value: calculatedDiscountPrice,
                        ...(lineItemId ? { line_item_id: lineItemId } : {})
                    }
                }
            })
        // ! Step#3.3 -> remove "customEffect"
        const newCouponCustomEffects = couponCustomEffects
            .filter((couponCustomEffect: any) => !invalidCouponIds.includes(couponCustomEffect.triggeredByCoupon))
            .filter((couponCustomEffect: any) => !invalidStackingCouponIds.includes(couponCustomEffect.triggeredByCoupon))
            .map((couponCustomEffect: any) => {
                const lineItemId = mapCouponCodeToLineItemId[couponCustomEffect.triggeredByCoupon]

                const {
                    discount_price: discountPrice = 0,
                    discount_percentage: discountPercentage = 0,
                    maximum_discount: maximumDiscount = 0
                } = couponCustomEffect.props.payload || {}

                const hasPercentageDiscount = discountPercentage > 0;
                const hasMaxCap = maximumDiscount > 0;

                let calculatedDiscountPrice = discountPrice

                if (hasPercentageDiscount) {
                    const rawDiscount = (totalPriceAfterCampaignDiscountInBaht * discountPercentage) / 100;
                    calculatedDiscountPrice = hasMaxCap ? Math.min(rawDiscount, maximumDiscount) : rawDiscount;
                }

                return {
                    ...couponCustomEffect,
                    props: {
                        ...couponCustomEffect.props,
                        payload: {
                            ...couponCustomEffect.props.payload,
                            ...(lineItemId ? { line_item_id: lineItemId } : {}),
                            calculated_discount_price: calculatedDiscountPrice
                        }
                    }
                }
            })
        // ! Step#3.4 -> move from "acceptCoupon" to "rejectCoupon"

        const rejectCouponEffects = acceptCouponEffects.filter((effect: any) => invalidCouponIds.includes(effect.triggeredByCoupon) || invalidStackingCouponIds.includes(effect.triggeredByCoupon))
            .map((effect: any) => {
                return {
                    ...effect,
                    effectType: 'rejectCoupon',
                    props: {
                        ...effect.props,
                        rejectionReason: 'CouponRejectedByCondition',
                        conditionIndex: -1
                    }
                }
            })

        const validEffects = [
            ...otherEffects,
            ...newAcceptCouponEffects,
            ...newSetDiscountEffects,
            ...newCouponCustomEffects,
            ...rejectCouponEffects
        ]
        return {
            validEffects
        }
    }

    private checkInAllowedList(filterList: any[], allowedList: any[]) {
        allowedList = allowedList.filter((v) => v !== 'null')
        if (filterList.length > 0 && allowedList.length > 0) {
            const allowedSet = new Set(allowedList);
            const intersect = filterList.filter(value => allowedSet.has(value));

            return !!intersect.length
        }

        return true
    }


    private checkInExcludedList(filterList: any[], excludedList: any[]) {
        excludedList = excludedList.filter((v) => v !== 'null')
        if (filterList.length > 0 && excludedList.length > 0) {
            const excludedSet = new Set(excludedList);
            const intersect = filterList.filter(value => excludedSet.has(value));

            return !!intersect.length
        }

        return false
    }
}
