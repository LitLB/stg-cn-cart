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
import { COUPON_REJECTION_REASONS } from '../constants/talon-one.interface';

export class TalonOneCouponAdapter {
    private ctpAddCustomCouponLineItemPrefix: string;
    private ctpTaxCategoryId: string;

    constructor() {
        this.ctpAddCustomCouponLineItemPrefix = readConfiguration().ctpAddCustomCouponLineItemPrefix;
        this.ctpTaxCategoryId = readConfiguration().ctpTaxCategoryId;
    }

    public processCouponEffects(effects: any[], cartInfoForCouponValidation?: any): {
        updateActions: CartUpdateAction[];
        acceptedCoupons: string[];
        rejectedCoupons: { code: string; reason: COUPON_REJECTION_REASONS }[];
        customEffects: any[];
        couponIdToCode: { [key: number]: string };
        couponIdToEffects: { [key: number]: any[] };
        applyCoupons: { code: string; }[];
    } {
        const updateActions: CartUpdateAction[] = [];
        const acceptedCoupons: string[] = [];
        const rejectedCoupons: { code: string; reason: COUPON_REJECTION_REASONS }[] = [];
        const customEffects: any[] = [];
        const couponIdToCode: { [key: number]: string } = {};
        const couponIdToEffects: { [key: number]: any[] } = {};
        const applyCoupons: { code: string; }[] = [];


        const validEffects = this.getValidCouponEffects(effects, cartInfoForCouponValidation)
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
            rejectedCoupons: { code: string; reason: COUPON_REJECTION_REASONS }[];
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
                        this.handleSetDiscountEffect(cart, updateActions, couponCode, props);
                        couponsWithCustomLineItems.add(couponCode);
                        break;

                    case 'addFreeItem':
                        this.handleAddFreeItemEffect(updateActions, props);
                        break;

                    case 'customEffect':
                        couponsInformation.push(this.prepareCouponInformation(couponCode, props));
                        break;
                    default:
                        break;
                }
            });
        }

        // Remove custom line items for rejected or missing coupons
        this.removeInvalidCustomLineItems(cart, updateActions, couponsWithCustomLineItems, acceptedCoupons);

        return { updateActions, couponsInformation };
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

    private prepareCouponInformation(couponCode: string, props: any): any {
        return {
            couponCode: couponCode,
            discountPrice: Number(props.payload.discount_price) || 0,
            discountPercentage: Number(props.payload.discount_percentage) || 0,
            discountCode: props.payload.discount_code,
            otherPaymentCode: props.payload.other_payment_code,
            marketingName: {
                en: props.payload.marketing_name_en,
                th: props.payload.marketing_name_th,
            },
            couponName: {
                th: props.payload.name_th || '',
                en: props.payload.name_th || '',
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
            excludedPackages: (props.payload.excluded_packages ?? []).filter((v: any) => v !== 'null')
        };
    }

    private getValidCouponEffects(effects: any[], cartInfoForCouponValidation?: any) {
        // let validEffects = effects
        const isAcceptCouponEffect = (effect: any) => effect.effectType === 'acceptCoupon'
        const isCouponSetDiscount = (effect: any) => effect.effectType === 'setDiscount' && effect.triggeredByCoupon
        const isCouponCustomEffect = (effect: any) => effect.effectType === 'customEffect' && effect.props.name === COUPON_CUSTOM_EFFECT
        const acceptCouponEffects = effects.filter((effect: any) => isAcceptCouponEffect(effect))
        const setDiscountEffects = effects.filter((effect: any) => isCouponSetDiscount(effect))
        const couponCustomEffects = effects.filter((effect: any) => isCouponCustomEffect(effect))
        const otherEffects = effects.filter((effect: any) => !isAcceptCouponEffect(effect) && !isCouponSetDiscount(effect) && !isCouponCustomEffect(effect))
        // 1. acceptCoupon -> .triggeredByCoupon
        // 2. setDiscount -> .triggeredByCoupon
        // 3. customEffect -> .triggeredByCoupon
        // 3.1 props.name.coupon_custom_effect_v3
        const invalidCouponIds: any = []
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
                allowed_products: allowedProducts = [],
                excluded_products: excludedProducts = [],
                allowed_series: allowedSeries = [],
                excluded_series: excludedSeries = [],
                allowed_brands: allowedBrands = [],
                excluded_brands: excludedBrands = [],
                allowed_categories: allowedCategories = [],
                excluded_categories: excludedCategories = [],
                // allowed_packages: allowedPackages = [],
                // excluded_packages: excludedPackages = [],
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


            const matchesSomeLineItem = lineItems.some((lineItem: any) => {
                const {
                    // lineItemId,
                    // index,
                    // productType,
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

            if (!matchesSomeLineItem) {
                invalidCouponIds.push(couponId)
                continue
            }
            // !TODO: allowed_packages
            // !TODO: excluded_packages

        }

        // ! Step#1 -> check customEffect
        // ! Step#2 -> if invalid then
        // ! Step#3.1 -> remove "acceptCoupon"
        const newAcceptCouponEffects = acceptCouponEffects.filter((acceptCouponEffect: any) => !invalidCouponIds.includes(acceptCouponEffect.triggeredByCoupon))
        // ! Step#3.2 -> remove "setDiscount"
        const newSetDiscountEffects = setDiscountEffects.filter((setDiscountEffect: any) => !invalidCouponIds.includes(setDiscountEffect.triggeredByCoupon))
        // ! Step#3.3 -> remove "customEffect"
        const newCouponCustomEffects = couponCustomEffects.filter((couponCustomEffect: any) => !invalidCouponIds.includes(couponCustomEffect.triggeredByCoupon))
        // ! Step#3.4 -> move from "acceptCoupon" to "rejectCoupon"

        const rejectCouponEffects = acceptCouponEffects.filter((effect: any) => invalidCouponIds.includes(effect.triggeredByCoupon))
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
        return validEffects
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
