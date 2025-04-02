// cart/src/services/coupon.service.ts

import {
    Cart,
    CartSetCustomFieldAction,
    CartUpdateAction
} from '@commercetools/platform-sdk';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { logger } from '../utils/logger.utils';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import { COUPON_REJECTION_REASONS } from '../interfaces/talon-one.interface';
import { Coupon } from '../interfaces/coupon.interface';
import { readConfiguration } from '../utils/config.utils';

export class CouponService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;
    private readonly ctProductClient;
    private readonly ctpAddCustomOtherPaymentLineItemPrefix;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
        this.ctProductClient = CommercetoolsProductClient;
        this.ctpAddCustomOtherPaymentLineItemPrefix = readConfiguration().ctpAddCustomOtherPaymentLineItemPrefix as string;
    }

    // T1 auto clear invalid coupons
    // CT update cart needed
    // Throw 400, with errorCode HANDLE_AUTO_REMOVE_COUPONS_FAILED
    public async autoRemoveInvalidCouponsAndReturnOnceV2(ctCart: Cart): Promise<{
        updatedCart: Cart;
        permanentlyInvalidRejectedCoupons: Coupon[];
    }> {
        try {
            const cartInfoForCouponValidation = await this.getCartInfoForCouponValidation(ctCart)
            // 1) Gather current coupon codes
            const couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCart(ctCart, cartInfoForCouponValidation);

            const currentCouponCodes: string[] =
                couponEffects?.coupons?.acceptedCoupons?.map((c: any) => c.code) ?? [];

            if (currentCouponCodes.length === 0 && couponEffects.coupons.rejectedCoupons.length === 0) {
                // No coupons to re-check
                return {
                    updatedCart: ctCart,
                    permanentlyInvalidRejectedCoupons: []
                };
            }

            // 2) Re-check with Talon.One to see if any have become invalid
            const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                profileId: ctCart.id,
                ctCartData: ctCart,
                couponCodes: currentCouponCodes,
            });
            const updatedSession = await talonOneIntegrationAdapter.updateCustomerSession(
                ctCart.id,
                customerSessionPayload
            );
            // 3) Process any effects
            const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(
                updatedSession.effects,
                cartInfoForCouponValidation
            );

            processedCouponEffects.rejectedCoupons = [...processedCouponEffects.rejectedCoupons, ...couponEffects.coupons.rejectedCoupons];

            // 3.1) Identify permanently invalid coupons
            const permanentlyInvalid = this.findPermanentlyInvalidCoupons(
                processedCouponEffects
            );
            if (permanentlyInvalid.length === 0) {
                return {
                    updatedCart: ctCart,
                    permanentlyInvalidRejectedCoupons: []
                };
            }

            // 4) Remove them from the Talon.One session
            const removeResult = await this.removeInvalidCouponsFromSession(
                ctCart.id,
                currentCouponCodes,
                permanentlyInvalid
            );

            // 5) Re-update the session with the final set of coupons
            const reUpdatedPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                profileId: ctCart.id,
                ctCartData: ctCart,
                couponCodes: removeResult.applyCoupons,
            });
            const reUpdatedSession = await talonOneIntegrationAdapter.updateCustomerSession(
                ctCart.id,
                reUpdatedPayload
            );

            // 6) Build updateActions from new effects to remove discount line items, etc.
            const newProcessedEffects = this.talonOneCouponAdapter.processCouponEffects(reUpdatedSession.effects, cartInfoForCouponValidation);
            const { updateActions, couponsInformation } =
                this.talonOneCouponAdapter.buildCouponActions(ctCart, newProcessedEffects);

            if (updateActions.length === 0) {
                // No cart changes needed
                return {
                    updatedCart: ctCart,
                    permanentlyInvalidRejectedCoupons: permanentlyInvalid
                };
            }

            // 7) Update the cart in CT
            const cartAfterAutoRemove = await CommercetoolsCartClient.updateCart(
                ctCart.id,
                ctCart.version,
                updateActions
            );

            // CN-CART, rejectedCoupons
            if (couponEffects.coupons.rejectedCoupons.length > 0) {
                // Sync CustomObject
                await this.addCouponInformation(updateActions, ctCart.id, couponsInformation);
                throw createStandardizedError(
                    {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: 'Some coupons were rejected during processing.',
                        data: couponEffects.coupons.rejectedCoupons,
                    },
                    'handleAutoRemoveCoupons'
                );
            }

            // Return the final cart and the list of invalid coupons
            return {
                updatedCart: cartAfterAutoRemove,
                permanentlyInvalidRejectedCoupons: permanentlyInvalid
            };

        } catch (error: any) {
            throw createStandardizedError(error, 'autoRemoveInvalidCouponsAndReturnOnce');
        }
    }

    public async autoRemoveInvalidCouponsAndReturnOnce(ctCart: Cart, isRemoveAllCoupon?: boolean): Promise<{
        updatedCart: Cart;
        permanentlyInvalidRejectedCoupons: Coupon[];
    }> {
        try {
            //HOTFIX: bundle_existing
            const lineItems = ctCart.lineItems.filter((lineItem) => lineItem.custom?.fields?.productType)

            // 1) Gather current coupon codes
            const cartInfoForCouponValidation = await this.getCartInfoForCouponValidation({
                ...ctCart,
                lineItems
            })
            const couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCart({
                ...ctCart,
                lineItems
            }, cartInfoForCouponValidation);
            console.log('couponEffects', JSON.stringify(couponEffects))
            const currentCouponCodes: string[] =
                couponEffects?.coupons?.acceptedCoupons?.map((coupons: any) => coupons.code) ?? [];


            // ? Comment this course need to remove the coupon code in talon 1 when cart change type or lineItems is empty
            // if (currentCouponCodes.length === 0) {
            //     // No coupons to re-check
            //     return {
            //         updatedCart: ctCart,
            //         permanentlyInvalidRejectedCoupons: []
            //     };
            // }

            // 2) Re-check with Talon.One to see if any have become invalid
            const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                profileId: ctCart.id,
                ctCartData: ctCart,
                couponCodes: isRemoveAllCoupon ? [] : currentCouponCodes,
            });
            const updatedSession = await talonOneIntegrationAdapter.updateCustomerSession(
                ctCart.id,
                customerSessionPayload
            );

            // 3) Process any effects
            const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(
                updatedSession.effects,
                cartInfoForCouponValidation
            );

            processedCouponEffects.rejectedCoupons = [...processedCouponEffects.rejectedCoupons, ...couponEffects.coupons.rejectedCoupons]

            // 3.1) Identify permanently invalid coupons
            const permanentlyInvalid = this.findPermanentlyInvalidCoupons(
                processedCouponEffects
            );
            if (permanentlyInvalid.length === 0) {
                return {
                    updatedCart: await this.syncCustomObjectCouponInformation(ctCart, processedCouponEffects),
                    permanentlyInvalidRejectedCoupons: []
                };
            }

            // 4) Remove them from the Talon.One session
            const removeResult = await this.removeInvalidCouponsFromSession(
                ctCart.id,
                currentCouponCodes,
                permanentlyInvalid
            );

            // 5) Re-update the session with the final set of coupons
            const reUpdatedPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                profileId: ctCart.id,
                ctCartData: ctCart,
                couponCodes: removeResult.applyCoupons,
            });
            const reUpdatedSession = await talonOneIntegrationAdapter.updateCustomerSession(
                ctCart.id,
                reUpdatedPayload
            );

            // 6) Build updateActions from new effects to remove discount line items, etc.
            const newProcessedEffects = this.talonOneCouponAdapter.processCouponEffects(reUpdatedSession.effects, cartInfoForCouponValidation);
            const { updateActions, couponsInformation } =
                this.talonOneCouponAdapter.buildCouponActions(ctCart, newProcessedEffects);

            // Update CustomObject with coupon information
            await this.addCouponInformation(
                updateActions,
                ctCart.id,
                couponsInformation
            );


            if (updateActions.length === 0) {
                // No cart changes needed
                return {
                    updatedCart: ctCart,
                    permanentlyInvalidRejectedCoupons: permanentlyInvalid
                };
            }

            // 7) Update the cart in CT
            const cartAfterAutoRemove = await CommercetoolsCartClient.updateCart(
                ctCart.id,
                ctCart.version,
                updateActions
            );

            // CN-CART, rejectedCoupons
            if (couponEffects.coupons.rejectedCoupons.length > 0) {
                throw createStandardizedError(
                    {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: 'Some coupons were rejected during processing.',
                        data: couponEffects.coupons.rejectedCoupons,
                    },
                    'handleAutoRemoveCoupons'
                );
            }

            // Return the final cart and the list of invalid coupons
            return {
                updatedCart: cartAfterAutoRemove,
                permanentlyInvalidRejectedCoupons: permanentlyInvalid
            };

        } catch (error: any) {
            console.log('error', error)
            throw createStandardizedError(error, 'autoRemoveInvalidCouponsAndReturnOnce');
        }
    }

    /**
     * Remove invalid coupons from the Talon.One session.
     * (Duplicating logic so we don't rely on a shared helper.)
     */
    private async removeInvalidCouponsFromSession(
        cartId: string,
        currentCouponCodes: string[],
        permanentlyInvalid: Array<{ code: string; reason: string }>
    ) {
        try {
            const codesToRemove = permanentlyInvalid.map((rc) => rc.code);
            const removeResult = await talonOneIntegrationAdapter.manageCouponsById(
                cartId,
                currentCouponCodes,
                codesToRemove
            );

            if (removeResult.error) {
                throw removeResult.error;
            }
            return removeResult;
        } catch (error: any) {
            logger.error('Failed to remove invalid coupons from session:', error);
            throw createStandardizedError(error, 'removeInvalidCouponsFromSession');
        }
    }

    /**
     * Add "couponInformation" to cart or remove it if no info is provided.
     */
    public addCouponInformation = async (
        updateActions: CartUpdateAction[],
        cartId: string,
        couponsInformation?: any[]
    ) => {
        try {
            // Attempt to add "couponInformation" custom object
            const addedCouponsInformation = await CommercetoolsCustomObjectClient.addCouponInformation(
                cartId,
                couponsInformation
            );

            // Only set or unset if we either have new info or had info before
            if (addedCouponsInformation) {
                const updateCustom: CartSetCustomFieldAction = {
                    action: 'setCustomField',
                    name: 'couponsInfomation',
                    value: {
                        typeId: 'key-value-document',
                        id: addedCouponsInformation.id
                    }
                };
                updateActions.push(updateCustom);
            } else {
                if (couponsInformation) {
                    const removeCustom: CartSetCustomFieldAction = {
                        action: 'setCustomField',
                        name: 'couponsInfomation',
                        value: null
                    };
                    updateActions.push(removeCustom);
                }
            }
        } catch (error: any) {
            logger.error('Failed to process coupons information', error);
            throw {
                statusCode: HTTP_STATUSES.INTERNAL_SERVER_ERROR,
                errorCode: 'COUPONS_INFORMATION_PROCESSING_FAILED',
                statusMessage: 'An error occurred while processing coupon information.'
            };
        }
    };

    private findPermanentlyInvalidCoupons(processedCouponEffects: any) {
        const permanentlyInvalidReasons = [
            COUPON_REJECTION_REASONS.COUPON_EXPIRED,
            COUPON_REJECTION_REASONS.COUPON_LIMIT_REACHED,
            COUPON_REJECTION_REASONS.COUPON_NOT_FOUND,
            COUPON_REJECTION_REASONS.COUPON_REJECTED_BY_CONDITION,
            COUPON_REJECTION_REASONS.PROFILE_LIMIT_REACHED,
        ];
        return (
            processedCouponEffects.rejectedCoupons?.filter((rc: any) =>
                permanentlyInvalidReasons.includes(rc.reason)
            ) || []
        );
    }

    /**
    * Clears all applied coupons from the cart.
    * @param ctCart The current cart object.
    * @returns A promise that resolves to the updated cart.
    */
    public async clearAllCoupons(ctCart: Cart, customerSession: any): Promise<Cart> {
        try {
            const cartInfoForCouponValidation = await this.getCartInfoForCouponValidation(ctCart)
            const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(customerSession.effects, cartInfoForCouponValidation);
            if (processedCouponEffects.acceptedCoupons.length === 0) {
                return ctCart;
            }

            const clearAllCouponsPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                profileId: ctCart.id,
                ctCartData: ctCart,
                couponCodes: [],
            });
            const clearAllCouponsUpdatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(
                ctCart.id,
                clearAllCouponsPayload
            );

            const clearAllCouponsEffects = this.talonOneCouponAdapter.processCouponEffects(clearAllCouponsUpdatedCustomerSession.effects, cartInfoForCouponValidation);
            const { updateActions } =
                this.talonOneCouponAdapter.buildCouponActions(ctCart, clearAllCouponsEffects);

            if (updateActions.length === 0) {
                return ctCart;
            }

            const updatedCart = await CommercetoolsCartClient.updateCart(
                ctCart.id,
                ctCart.version,
                updateActions
            );

            return updatedCart;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'clearAllCoupons');
        }
    }

    private async syncCustomObjectCouponInformation(ctCart: any, processedCouponEffects: any): Promise<Cart> {
        const { updateActions, couponsInformation } = this.talonOneCouponAdapter.buildCouponActions(ctCart, processedCouponEffects);

        // Update CustomObject with coupon information
        await this.addCouponInformation(updateActions, ctCart.id, couponsInformation);

        if (updateActions.length === 0) {
            // No cart changes needed
            return ctCart
        }

        // Update the cart in CT
        const cartAfterUpdateCustomObject = await CommercetoolsCartClient.updateCart(
            ctCart.id,
            ctCart.version,
            updateActions
        );

        return cartAfterUpdateCustomObject;
    }

    private calculateLineItemOtherPaymentAmount(lineItem: any, customLineItems: any[]) {
        const lineItemId = lineItem.id

        const otherPaymentCustomLineItems =
            customLineItems.filter((item: any) => item.slug.startsWith(`${lineItemId}-${this.ctpAddCustomOtherPaymentLineItemPrefix}`))
        const lineItemOtherPaymentAmount = otherPaymentCustomLineItems.reduce((acc: number, current: any) => {
            return acc + Math.abs(current?.totalPrice?.centAmount)
        }, 0)

        return lineItemOtherPaymentAmount
    }

    getCartInfoForCouponValidation = async (ctCart: any) => {
        const campaignGroup = ctCart.custom.fields.campaignGroup
        const journey = ctCart.custom.fields.journey

        const lineItems = ctCart.lineItems
        const customLineItems = ctCart.customLineItems

        const totalPriceAfterCampaignDiscount = lineItems.reduce((total: number, lineItem: any) => {
            const otherPaymentAmount = this.calculateLineItemOtherPaymentAmount(lineItem, customLineItems);
            return total + (lineItem.totalPrice.centAmount - otherPaymentAmount)
        }, 0)

        const allSkus = lineItems.map((item: any) => item.variant.sku)
        let products = []
        if (allSkus.length) {
            const { body } = await this.ctProductClient.getProductsBySkus(allSkus, ['categories[*].parent'])
            products = body.results;
        }

        const productIdToProducts = products.reduce((acc: any, product: any) => {
            acc[product.id] = product
            return acc
        }, [])

        const filterLineItems = lineItems.map((lineItem: any, lineItemIndex: number) => {
            const lineItemId = lineItem.id
            const productType = lineItem.custom.fields.productType
            const sku = lineItem.variant.sku
            const attributes: any = lineItem?.attributes?.reduce((acc: any, current: any) => {
                const name = current.name
                const value = current.value
                acc[name] = value
                return acc
            }, {})

            const product = productIdToProducts?.[lineItem.productId] || {}
            const parentCategoryName = product?.categories?.[0]?.obj?.parent?.obj?.name || null
            const categoryName = product?.categories?.[0]?.obj?.name || null

            const category = parentCategoryName || categoryName
            return {
                lineItemId,
                index: lineItemIndex,
                productType,
                sku,
                ...(attributes?.series ? { series: attributes?.series } : {}),
                ...(category ? { category: category?.['en-US'] } : {}),
                ...(attributes?.brand_name?.label ? { brand: attributes?.brand_name?.label } : {})
            }
        })
        return {
            campaignGroup,
            journey,
            totalPriceAfterCampaignDiscountInBaht: totalPriceAfterCampaignDiscount / 100,
            lineItems: filterLineItems
        }
    }
}
