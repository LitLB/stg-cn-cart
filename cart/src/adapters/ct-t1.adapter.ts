// cart/src/adapters/ct-t1.adapter.ts

import {
    CartAddCustomLineItemAction,
    CartAddLineItemAction,
    CartSetCustomFieldAction,
    CartUpdateAction,
} from '@commercetools/platform-sdk';
import { readConfiguration } from '../utils/config.utils';

export class CtT1Adapter {
    private ctpAddCustomCouponLineItemPrefix: string;
    private ctpTaxCategoryId: string;

    constructor() {
        this.ctpAddCustomCouponLineItemPrefix = readConfiguration().ctpAddCustomCouponLineItemPrefix;
        this.ctpTaxCategoryId = readConfiguration().ctpTaxCategoryId;
    }

    handleEffectsV5(effects: any[], cart: any): CartUpdateAction[] {
        const updateActions: CartUpdateAction[] = [];
        const acceptedCoupons: string[] = [];
        const rejectedCoupons: string[] = [];
        const couponIdToCode: { [key: number]: string } = {};
        const couponIdToEffects: { [key: number]: any[] } = {};

        // Process effects to build mappings
        this.processEffects(effects, acceptedCoupons, rejectedCoupons, couponIdToCode, couponIdToEffects);

        // Process accepted coupons and their associated effects
        this.processAcceptedCoupons(
            cart,
            updateActions,
            couponIdToCode,
            couponIdToEffects
        );

        // Update accepted and rejected coupons in cart custom fields
        this.updateCartCustomFields(cart, updateActions, acceptedCoupons, rejectedCoupons);

        return updateActions;
    }

    private processEffects(
        effects: any[],
        acceptedCoupons: string[],
        rejectedCoupons: string[],
        couponIdToCode: { [key: number]: string },
        couponIdToEffects: { [key: number]: any[] }
    ): void {
        effects.forEach(effect => {
            const { effectType, props, triggeredByCoupon } = effect;

            if (triggeredByCoupon) {
                if (!couponIdToEffects[triggeredByCoupon]) {
                    couponIdToEffects[triggeredByCoupon] = [];
                }
                couponIdToEffects[triggeredByCoupon].push(effect);
            }

            if (effectType === 'acceptCoupon') {
                acceptedCoupons.push(props.value);
                if (triggeredByCoupon) {
                    couponIdToCode[triggeredByCoupon] = props.value;
                }
            } else if (effectType === 'rejectCoupon') {
                rejectedCoupons.push(props.value);
            }
        });
    }

    private processAcceptedCoupons(
        cart: any,
        updateActions: CartUpdateAction[],
        couponIdToCode: { [key: number]: string },
        couponIdToEffects: { [key: number]: any[] }
    ): void {
        for (const triggeredByCoupon in couponIdToCode) {
            const couponCode = couponIdToCode[triggeredByCoupon];
            const associatedEffects = couponIdToEffects[triggeredByCoupon];

            associatedEffects.forEach(effect => {
                const { effectType, props } = effect;

                switch (effectType) {
                    case 'setDiscount':
                        this.handleSetDiscountEffect(cart, updateActions, couponCode, props);
                        break;

                    case 'addFreeItem':
                        this.handleAddFreeItemEffect(updateActions, props);
                        break;

                    default:
                        console.warn(`Effect type "${effectType}" not supported`);
                        break;
                }
            });
        }
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

        if (!existingCustomLineItem) {
            const customLineItem: CartAddCustomLineItemAction = {
                action: 'addCustomLineItem',
                name: { en: `${this.ctpAddCustomCouponLineItemPrefix}${couponCode}` },
                money: {
                    centAmount: -Math.round(props.value * 100),
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
            console.warn(`Custom line item with slug "${slug}" already exists.`);
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

    private updateCartCustomFields(
        cart: any,
        updateActions: CartUpdateAction[],
        acceptedCoupons: string[],
        rejectedCoupons: string[]
    ): void {
        // Update acceptedCoupons
        if (acceptedCoupons.length > 0) {
            const existingAcceptedCoupons = cart.custom?.fields?.acceptedCoupons || [];
            const allAcceptedCoupons = [...existingAcceptedCoupons, ...acceptedCoupons];
            const uniqueAcceptedCoupons = Array.from(new Set(allAcceptedCoupons));
            const setCustomFieldAction: CartSetCustomFieldAction = {
                action: 'setCustomField',
                name: 'acceptedCoupons',
                value: uniqueAcceptedCoupons,
            };
            updateActions.push(setCustomFieldAction);
        }

        // Update rejectedCoupons
        if (rejectedCoupons.length > 0) {
            const existingRejectedCoupons = cart.custom?.fields?.rejectedCoupons || [];
            const allRejectedCoupons = [...existingRejectedCoupons, ...rejectedCoupons];
            const uniqueRejectedCoupons = Array.from(
                new Map(allRejectedCoupons.map(item => [item.code, item])).values()
            );
            const setCustomFieldAction: CartSetCustomFieldAction = {
                action: 'setCustomField',
                name: 'rejectedCoupons',
                value: uniqueRejectedCoupons,
            };
            updateActions.push(setCustomFieldAction);
        }
    }
}
