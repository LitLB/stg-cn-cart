// cart/src/services/coupon.service.ts

import { Cart, CartSetCustomFieldAction, CartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { logger } from '../utils/logger.utils';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import { COUPON_REJECTION_REASONS } from '../interfaces/talon-one.interface';

export class CouponService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
    }

    public async autoRemoveInvalidCouponsAndReturnOnce(ctCart: Cart): Promise<{
        updatedCart: Cart;
        permanentlyInvalidRejectedCoupons: Array<{ code: string; reason: string }>;
    }> {
        try {
            // 1) If no lineItems, skip
            if (!ctCart.lineItems || ctCart.lineItems.length === 0) {
                return {
                    updatedCart: ctCart,
                    permanentlyInvalidRejectedCoupons: []
                };
            }

            // 2) Gather current coupon codes
            const profileId = ctCart.id;
            const couponEffects = await this.talonOneCouponAdapter.getCouponEffectsByCtCartId(ctCart.id, ctCart.lineItems);
            const currentCouponCodes: string[] =
                couponEffects?.coupons?.acceptedCoupons?.map((c: any) => c.code) ?? [];

            if (currentCouponCodes.length === 0) {
                // No coupons to re-check
                return {
                    updatedCart: ctCart,
                    permanentlyInvalidRejectedCoupons: []
                };
            }

            // 3) Re-check with Talon.One to see if any have become invalid
            const customerSessionPayload = {
                customerSession: {
                    profileId,
                    cartItems: [],
                    couponCodes: currentCouponCodes
                },
                responseContent: ["customerSession", "customerProfile", "triggeredCampaigns", "coupons"]
            };

            const updatedSession = await talonOneIntegrationAdapter.updateCustomerSession(
                profileId,
                customerSessionPayload
            );

            // Process any effects
            const talonEffects = updatedSession.effects;
            const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(talonEffects);

            // 4) Identify permanently invalid coupons
            const permanentlyInvalid =
                processedCouponEffects.rejectedCoupons?.filter((rc: any) =>
                    [
                        COUPON_REJECTION_REASONS.COUPON_EXPIRED,
                        COUPON_REJECTION_REASONS.COUPON_LIMIT_REACHED,
                        COUPON_REJECTION_REASONS.COUPON_NOT_FOUND,
                        COUPON_REJECTION_REASONS.COUPON_REJECTED_BY_CONDITION,
                        COUPON_REJECTION_REASONS.PROFILE_LIMIT_REACHED,
                    ].includes(rc.reason)
                ) || [];
            if (permanentlyInvalid.length === 0) {
                // Nothing to remove
                return {
                    updatedCart: ctCart,
                    permanentlyInvalidRejectedCoupons: []
                };
            }

            // 5) Remove them from the Talon.One session
            const removeResult = await this.removeInvalidCouponsFromSession(
                ctCart.id,
                currentCouponCodes,
                permanentlyInvalid
            );

            // 6) Re-update the session with the final set of coupons
            const reUpdatedSession = await talonOneIntegrationAdapter.updateCustomerSession(profileId, {
                customerSession: {
                    profileId,
                    cartItems: [],
                    couponCodes: removeResult.applyCoupons
                },
                responseContent: ["customerSession", "customerProfile", "triggeredCampaigns", "coupons"]
            });

            // 7) Build updateActions from new effects to remove discount line items, etc.
            const newEffects = reUpdatedSession.effects;
            const newProcessedEffects = this.talonOneCouponAdapter.processCouponEffects(newEffects);
            const { updateActions } = this.talonOneCouponAdapter.buildCouponActions(ctCart, newProcessedEffects);

            if (updateActions.length === 0) {
                // No cart changes needed
                return {
                    updatedCart: ctCart,
                    permanentlyInvalidRejectedCoupons: permanentlyInvalid
                };
            }

            // 8) Update the cart in CT
            const cartAfterAutoRemove = await CommercetoolsCartClient.updateCart(
                ctCart.id,
                ctCart.version,
                updateActions
            );

            // Return the final cart and the list of invalid coupons
            return {
                updatedCart: cartAfterAutoRemove,
                permanentlyInvalidRejectedCoupons: permanentlyInvalid
            };

        } catch (error: any) {
            throw createStandardizedError(error, 'autoRemoveInvalidCouponsAndReturnOnce');
        }
    }

    /**
     * Remove invalid coupons from the Talon.One session.
     */
    private async removeInvalidCouponsFromSession(
        cartId: string,
        currentCouponCodes: string[],
        permanentlyInvalid: Array<{ code: string; reason: string }>
    ) {
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
    }

    public addCouponInformation = async (updateActions: CartUpdateAction[], cartId: string, couponsInformation?: any[]) => {
        try {
            // Attempt to add "couponInformation" custom object
            const addedCouponsInformation = await CommercetoolsCustomObjectClient.addCouponInformation(
                cartId,
                couponsInformation
            );

            // Only set or unset if we either have new info or had info before
            if (addedCouponsInformation) {
                // We do have new info => set it
                const updateCustom: CartSetCustomFieldAction = {
                    action: 'setCustomField',
                    name: 'couponInfomation',
                    value: [
                        {
                            typeId: "key-value-document",
                            id: addedCouponsInformation.id,
                        },
                    ],
                };
                updateActions.push(updateCustom);
            } else {
                // If the cart currently has couponInfomation defined, remove it
                if (couponsInformation) {
                    const removeCustom: CartSetCustomFieldAction = {
                        action: 'setCustomField',
                        name: 'couponInfomation',
                        value: null,
                    };
                    updateActions.push(removeCustom);
                }
            }

        } catch (error: any) {
            logger.error('Failed to process coupons information', error);
            throw {
                statusCode: HTTP_STATUSES.INTERNAL_SERVER_ERROR,
                errorCode: "COUPONS_INFORMATION_PROCESSING_FAILED",
                statusMessage: 'An error occurred while processing coupon information.',
            };
        }
    }
}