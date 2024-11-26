// cart/src/adapters/ct-t1.adapter.ts

import type { CartAddCustomLineItemAction, CartAddLineItemAction, CartSetCustomFieldAction, CartSetDirectDiscountsAction, CartUpdateAction, MyCartUpdateAction } from "@commercetools/platform-sdk";

export class CtT1Adapter {
    handleEffects(effects: any[], cart: any): CartUpdateAction[] {
        const updateActions: CartUpdateAction[] = [];
        const directDiscounts: any[] = [];

        effects.forEach(effect => {
            const { effectType, props } = effect;
            console.log("effectType", effectType);
            console.log("props", props);

            switch (effectType) {
                // case 'setDiscount': {
                //     // Handle global cart discount by adding a custom line item
                //     const customLineItem: CartAddCustomLineItemAction = {
                //         action: 'addCustomLineItem',
                //         name: { en: props.name },
                //         money: {
                //             centAmount: -Math.round(props.value * 100),
                //             currencyCode: cart.totalPrice.currencyCode,
                //         },
                //         quantity: 1,
                //         slug: `talon-one-discount-${Date.now()}`,
                //         taxCategory: {
                //             typeId: 'tax-category',
                //             id: 'your-tax-category-id', // Replace with actual tax category ID
                //         },
                //     };
                //     updateActions.push(customLineItem);
                //     break;
                // }
                // case 'setDiscountPerItem': {
                //     // Handle per-item discount by applying a direct discount to the line item
                //     const lineItem = cart.lineItems[props.position];
                //     if (lineItem) {
                //         const predicate = `lineItemId="${lineItem.id}"`;

                //         const discount = {
                //             target: {
                //                 type: 'lineItems',
                //                 predicate,
                //             },
                //             value: {
                //                 type: 'absolute',
                //                 money: [
                //                     {
                //                         centAmount: Math.round(props.value * 100),
                //                         currencyCode: lineItem.price.value.currencyCode,
                //                     },
                //                 ],
                //             },
                //         };

                //         directDiscounts.push(discount);
                //     }
                //     break;
                // }
                // case 'addFreeItem': {
                //     // Handle adding a free item to the cart
                //     const addLineItemAction: CartAddLineItemAction = {
                //         action: 'addLineItem',
                //         productId: props.productId,
                //         variantId: props.variantId,
                //         quantity: props.quantity || 1,
                //         externalPrice: {
                //             currencyCode: cart.totalPrice.currencyCode,
                //             centAmount: 0,
                //         },
                //         custom: {
                //             type: {
                //                 typeId: 'type',
                //                 key: 'lineItemCustomType', // Replace with your custom type key
                //             },
                //             fields: {
                //                 isFreeItem: true,
                //                 // Add other custom fields if necessary
                //             },
                //         },
                //     };
                //     updateActions.push(addLineItemAction);
                //     break;
                // }
                case 'acceptCoupon': {
                    const existingAppceptedCoupons = cart.custom?.fields?.acceptedCoupons || [];
                    const setCustomFieldAction: CartSetCustomFieldAction = {
                        action: 'setCustomField',
                        name: 'acceptedCoupons',
                        value: [...existingAppceptedCoupons, props.value],
                    };
                    updateActions.push(setCustomFieldAction);
                    break;
                }
                case 'rejectCoupon': {
                    const existingRejectedCoupons = cart.custom?.fields?.rejectedCoupons || [];
                    const setCustomFieldAction: CartSetCustomFieldAction = {
                        action: 'setCustomField',
                        name: 'rejectedCoupons',
                        value: [
                            ...existingRejectedCoupons,
                            { code: props.value, reason: props.rejectionReason },
                        ],
                    };
                    updateActions.push(setCustomFieldAction);
                    console.warn(`Coupon ${props.value} was rejected: ${props.rejectionReason}`);
                    break;
                }
                default:
                    console.warn(`Effect type "${effectType}" not supported`);
            }
        });

        // Apply direct discounts if any
        if (directDiscounts.length > 0) {
            const setDirectDiscountsAction: CartSetDirectDiscountsAction = {
                action: 'setDirectDiscounts',
                discounts: directDiscounts,
            };
            updateActions.push(setDirectDiscountsAction);
        }

        return updateActions;
    }

    handleEffectsV2(effects: any[], cart: any): CartUpdateAction[] {
        const updateActions: CartUpdateAction[] = [];
        const directDiscounts: any[] = [];
        const acceptedCoupons: string[] = [];
        const rejectedCoupons: { code: string; reason: string }[] = [];

        effects.forEach(effect => {
            const { effectType, props } = effect;
            console.log('effectType', effectType);
            console.log('props', props);

            switch (effectType) {
                case 'acceptCoupon': {
                    acceptedCoupons.push(props.value);
                    break;
                }
                case 'rejectCoupon': {
                    rejectedCoupons.push(props.value);
                    console.warn(`Coupon ${props.value} was rejected: ${props.rejectionReason}`);
                    break;
                }
                // Handle other effect types...
                default:
                    console.warn(`Effect type "${effectType}" not supported`);
            }
        });

        // Update acceptedCoupons
        if (acceptedCoupons.length > 0) {
            const existingAcceptedCoupons = cart.custom?.fields?.acceptedCoupons || [];
            const setCustomFieldAction: CartSetCustomFieldAction = {
                action: 'setCustomField',
                name: 'acceptedCoupons',
                value: [...new Set([...existingAcceptedCoupons, ...acceptedCoupons])],
            };
            updateActions.push(setCustomFieldAction);
        }

        // Update rejectedCoupons
        if (rejectedCoupons.length > 0) {
            const existingRejectedCoupons = cart.custom?.fields?.rejectedCoupons || [];
            const setCustomFieldAction: CartSetCustomFieldAction = {
                action: 'setCustomField',
                name: 'rejectedCoupons',
                value: [...existingRejectedCoupons, ...rejectedCoupons],
            };
            updateActions.push(setCustomFieldAction);
        }

        // Apply direct discounts if any
        if (directDiscounts.length > 0) {
            const setDirectDiscountsAction: CartSetDirectDiscountsAction = {
                action: 'setDirectDiscounts',
                discounts: directDiscounts,
            };
            updateActions.push(setDirectDiscountsAction);
        }

        return updateActions;
    }

    handleEffectsV3(effects: any[], cart: any): CartUpdateAction[] {
        const updateActions: CartUpdateAction[] = [];
        const directDiscounts: any[] = [];
        const acceptedCoupons: string[] = [];
        const rejectedCoupons: { code: string; reason: string }[] = [];

        effects.forEach(effect => {
            const { effectType, props } = effect;

            switch (effectType) {
                case 'setDiscount': {
                    // Handle global cart discount by adding a custom line item
                    const customLineItem: CartAddCustomLineItemAction = {
                        action: 'addCustomLineItem',
                        name: { en: props.name },
                        money: {
                            centAmount: -Math.round(props.value * 100),
                            currencyCode: cart.totalPrice.currencyCode,
                        },
                        quantity: 1,
                        slug: `talon-one-discount-${Date.now()}`,
                        taxCategory: {
                            typeId: 'tax-category',
                            id: 'your-tax-category-id', // Replace with actual tax category ID
                        },
                    };
                    updateActions.push(customLineItem);
                    break;
                }
                case 'setDiscountPerItem': {
                    // Handle per-item discount by applying a direct discount to the line item
                    const lineItem = cart.lineItems[props.position];
                    if (lineItem) {
                        const discount = {
                            target: {
                                type: 'lineItem',
                                lineItemId: lineItem.id,
                            },
                            value: {
                                type: 'absolute',
                                money: [
                                    {
                                        centAmount: Math.round(props.value * 100),
                                        currencyCode: lineItem.price.value.currencyCode,
                                    },
                                ],
                            },
                        };

                        directDiscounts.push(discount);
                    }
                    break;
                }
                case 'addFreeItem': {
                    // Handle adding a free item to the cart
                    const addLineItemAction: CartAddLineItemAction = {
                        action: 'addLineItem',
                        productId: props.productId,
                        variantId: props.variantId,
                        quantity: props.quantity || 1,
                        externalPrice: {
                            currencyCode: cart.totalPrice.currencyCode,
                            centAmount: 0,
                        },
                        custom: {
                            type: {
                                typeId: 'type',
                                key: 'lineItemCustomType', // Replace with your custom type key
                            },
                            fields: {
                                isFreeItem: true,
                                // Add other custom fields if necessary
                            },
                        },
                    };
                    updateActions.push(addLineItemAction);
                    break;
                }
                case 'acceptCoupon': {
                    acceptedCoupons.push(props.value);
                    break;
                }
                case 'rejectCoupon': {
                    rejectedCoupons.push(props.value);
                    console.warn(`Coupon ${props.value} was rejected: ${props.rejectionReason}`);
                    break;
                }
                default:
                    console.warn(`Effect type "${effectType}" not supported`);
            }
        });

        // Update acceptedCoupons
        if (acceptedCoupons.length > 0) {
            const existingAcceptedCoupons = cart.custom?.fields?.acceptedCoupons || [];
            const setCustomFieldAction: CartSetCustomFieldAction = {
                action: 'setCustomField',
                name: 'acceptedCoupons',
                value: [...new Set([...existingAcceptedCoupons, ...acceptedCoupons])],
            };
            updateActions.push(setCustomFieldAction);
        }

        // Update rejectedCoupons
        if (rejectedCoupons.length > 0) {
            const existingRejectedCoupons = cart.custom?.fields?.rejectedCoupons || [];
            const setCustomFieldAction: CartSetCustomFieldAction = {
                action: 'setCustomField',
                name: 'rejectedCoupons',
                value: [...existingRejectedCoupons, ...rejectedCoupons],
            };
            updateActions.push(setCustomFieldAction);
        }

        // Apply direct discounts if any
        if (directDiscounts.length > 0) {
            const setDirectDiscountsAction: CartSetDirectDiscountsAction = {
                action: 'setDirectDiscounts',
                discounts: directDiscounts,
            };
            updateActions.push(setDirectDiscountsAction);
        }

        return updateActions;
    }

    handleEffectsV4(effects: any[], cart: any): CartUpdateAction[] {
        const updateActions: CartUpdateAction[] = [];
        const directDiscounts: any[] = [];
        const acceptedCoupons: string[] = [];
        const rejectedCoupons: { code: string; reason: string }[] = [];

        effects.forEach(effect => {
            const { effectType, props } = effect;
            console.log('effectType', effectType);
            console.log('props', props);

            switch (effectType) {
                case 'setDiscount': {
                    // Handle global cart discount by adding a custom line item
                    const customLineItem: CartAddCustomLineItemAction = {
                        action: 'addCustomLineItem',
                        name: { en: props.name },
                        money: {
                            centAmount: -Math.round(props.value * 100),
                            currencyCode: cart.totalPrice.currencyCode,
                        },
                        quantity: 1,
                        slug: `talon-one-coupon-discount-${props.value}`,
                        taxCategory: {
                            typeId: 'tax-category',
                            id: 'fb18160d-f163-4d67-9e9c-f657653fdf25',
                        },
                    };
                    updateActions.push(customLineItem);
                    break;
                }
                // case 'setDiscountPerItem': {
                //     // Handle per-item discount by applying a direct discount to the line item
                //     const lineItem = cart.lineItems[props.position];
                //     if (lineItem) {
                //         const discount = {
                //             target: {
                //                 type: 'lineItem',
                //                 lineItemId: lineItem.id,
                //             },
                //             value: {
                //                 type: 'absolute',
                //                 money: [
                //                     {
                //                         centAmount: Math.round(props.value * 100),
                //                         currencyCode: lineItem.price.value.currencyCode,
                //                     },
                //                 ],
                //             },
                //         };

                //         directDiscounts.push(discount);
                //     }
                //     break;
                // }
                case 'addFreeItem': {
                    // Handle adding a free item to the cart
                    const addLineItemAction: CartAddLineItemAction = {
                        action: 'addLineItem',
                        productId: props.productId,
                        variantId: props.variantId,
                        quantity: props.quantity || 1,
                        externalPrice: {
                            currencyCode: cart.totalPrice.currencyCode,
                            centAmount: 0,
                        },
                        custom: {
                            type: {
                                typeId: 'type',
                                key: 'lineItemCustomType', // Replace with your custom type key
                            },
                            fields: {
                                isFreeItem: true,
                                // Add other custom fields if necessary
                            },
                        },
                    };
                    updateActions.push(addLineItemAction);
                    break;
                }
                case 'acceptCoupon': {
                    acceptedCoupons.push(props.value);
                    break;
                }
                case 'rejectCoupon': {
                    rejectedCoupons.push(props.value);
                    console.warn(`Coupon ${props.value} was rejected: ${props.rejectionReason}`);
                    break;
                }
                default:
                    console.warn(`Effect type "${effectType}" not supported`);
            }
        });

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

        // Update acceptedCoupons
        if (rejectedCoupons.length > 0) {
            const existingAcceptedCoupons = cart.custom?.fields?.rejectedCoupons || [];
            const allRejectedCoupons = [...existingAcceptedCoupons, ...rejectedCoupons];
            const uniqueAcceptedCoupons = Array.from(new Set(allRejectedCoupons));
            const setCustomFieldAction: CartSetCustomFieldAction = {
                action: 'setCustomField',
                name: 'rejectedCoupons',
                value: uniqueAcceptedCoupons,
            };
            updateActions.push(setCustomFieldAction);
        }

        // Apply direct discounts if any
        if (directDiscounts.length > 0) {
            const setDirectDiscountsAction: CartSetDirectDiscountsAction = {
                action: 'setDirectDiscounts',
                discounts: directDiscounts,
            };
            updateActions.push(setDirectDiscountsAction);
        }

        return updateActions;
    }

    handleEffectsV5(effects: any[], cart: any): CartUpdateAction[] {
        const updateActions: CartUpdateAction[] = [];
        const acceptedCoupons: string[] = [];
        const rejectedCoupons: { code: string; reason: string }[] = [];
        const couponIdToCode: { [key: number]: string } = {};
        const couponIdToEffects: { [key: number]: any[] } = {};

        // First, process effects to build mappings
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

        // Now, process accepted coupons and their associated effects
        for (const triggeredByCoupon in couponIdToCode) {
            const couponCode = couponIdToCode[triggeredByCoupon];
            const associatedEffects = couponIdToEffects[triggeredByCoupon];

            associatedEffects.forEach(effect => {
                const { effectType, props } = effect;

                switch (effectType) {
                    case 'setDiscount': {
                        // Check if a custom line item with the same slug already exists
                        const slug = `talon-one-coupon-discount-${couponCode}`;
                        const existingCustomLineItem = cart.customLineItems.find(
                            (item: any) => item.slug === slug
                        );

                        if (!existingCustomLineItem) {
                            // Handle global cart discount by adding a custom line item
                            const customLineItem: CartAddCustomLineItemAction = {
                                action: 'addCustomLineItem',
                                name: { en: props.name },
                                money: {
                                    centAmount: -Math.round(props.value * 100),
                                    currencyCode: cart.totalPrice.currencyCode,
                                },
                                quantity: 1,
                                slug,
                                taxCategory: {
                                    typeId: 'tax-category',
                                    id: 'fb18160d-f163-4d67-9e9c-f657653fdf25', // Replace with actual tax category ID
                                },
                            };
                            updateActions.push(customLineItem);
                        } else {
                            console.warn(`Custom line item with slug "${slug}" already exists.`);
                        }
                        break;
                    }
                    case 'addFreeItem': {
                        // Handle adding a free item to the cart
                        const addLineItemAction: CartAddLineItemAction = {
                            action: 'addLineItem',
                            productId: props.productId,
                            variantId: props.variantId,
                            quantity: props.quantity || 1,
                            externalPrice: {
                                currencyCode: cart.totalPrice.currencyCode,
                                centAmount: 0,
                            },
                            custom: {
                                type: {
                                    typeId: 'type',
                                    key: 'lineItemCustomType', // Replace with your custom type key
                                },
                                fields: {
                                    isFreeItem: true,
                                    // Add other custom fields if necessary
                                },
                            },
                        };
                        updateActions.push(addLineItemAction);
                        break;
                    }
                    // You can add more effect types if needed
                    default:
                        break;
                }
            });
        }

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

        if (rejectedCoupons.length > 0) {
            const existingAcceptedCoupons = cart.custom?.fields?.rejectedCoupons || [];
            const allRejectedCoupons = [...existingAcceptedCoupons, ...rejectedCoupons];
            const uniqueAcceptedCoupons = Array.from(new Set(allRejectedCoupons));
            const setCustomFieldAction: CartSetCustomFieldAction = {
                action: 'setCustomField',
                name: 'rejectedCoupons',
                value: uniqueAcceptedCoupons,
            };
            updateActions.push(setCustomFieldAction);
        }

        return updateActions;
    }

}