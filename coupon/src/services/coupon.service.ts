// coupon/src/services/coupon.service.ts

import { ICart } from '../interfaces/cart';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { validateCouponLimit } from '../validators/coupon.validator';
import { logger } from '../utils/logger.utils';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { COUPON_REJECTION_REASONS } from '../constants/talon-one.interface';
import {
    CartSetCustomFieldAction,
    CartUpdateAction
} from '@commercetools/platform-sdk';

export class CouponService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
    }

    public applyCoupons = async (
        accessToken: string,
        id: string,
        body: any
    ): Promise<any> => {
        try {
            // 1) Grab new codes from the request body
            const couponCodes = body.couponCodes || [];
            const removeCouponCodes = body.removeCouponCodes || [];

            // Validate coupon limit
            const validateError = validateCouponLimit(couponCodes.length);
            if (validateError) {
                throw validateError;
            }

            // 2) Manage coupon codes in Talon.One session (merges duplicates, removes user-requested, etc.)
            const resultCoupons = await talonOneIntegrationAdapter.manageCouponsById(
                id,
                couponCodes,
                removeCouponCodes
            );
            if (resultCoupons.error) {
                throw resultCoupons.error;
            }

            // Update local couponCodes array with Talon.One's final list
            couponCodes.splice(0, couponCodes.length, ...resultCoupons.applyCoupons);

            // 3) Get the Commercetools cart
            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
            const ctCart = await commercetoolsMeCartClient.getCartById(id);
            if (!ctCart) {
                logger.info('Commercetools getCartById error');
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    errorCode: 'APPLY_COUPON_CT_FAILED',
                    statusMessage: 'Cart not found or has expired',
                };
            }

            // 4) Update Talon.One session to reflect final coupon codes
            const payload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                profileId: ctCart.id,
                ctCartData: ctCart,
                couponCodes,
            });
            let updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(
                ctCart.id,
                payload
            );

            // 5) Process returned effects
            const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(
                updatedCustomerSession.effects
            );

            // 5.1) Identify “permanently invalid” coupons and remove them if found
            const permanentlyInvalid = this.findPermanentlyInvalidCoupons(
                processedCouponEffects
            );

            const initiallyRejectedCoupons = [
                ...(processedCouponEffects.rejectedCoupons || []),
            ];

            if (permanentlyInvalid.length > 0) {
                // Remove them from the session
                removeCouponCodes.push(...permanentlyInvalid.map((rc: any) => rc.code));

                const removeResult = await this.removeInvalidCouponsFromSession(
                    ctCart.id,
                    couponCodes,
                    permanentlyInvalid
                );
                if (removeResult.error) {
                    throw removeResult.error;
                }

                // Update local couponCodes array to reflect final state
                couponCodes.splice(0, couponCodes.length, ...removeResult.applyCoupons);

                // Optionally re-update the session to get a “clean” effect list
                const cleanedPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                    profileId: ctCart.id,
                    ctCartData: ctCart,
                    couponCodes,
                });
                updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(
                    ctCart.id,
                    cleanedPayload
                );
            }

            // Re-process effects if the session was updated again
            const finalEffects = updatedCustomerSession.effects;
            const finalProcessedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(finalEffects);
            // console.log('finalProcessedCouponEffects', finalProcessedCouponEffects);

            // 6) Build final cart update actions from the coupon effects
            const { updateActions, couponsInformation } = this.talonOneCouponAdapter.buildCouponActions(
                ctCart,
                finalProcessedCouponEffects
            );

            // Update CustomObject with coupon information
            await this.addCouponInformation(
                updateActions,
                ctCart.id,
                couponsInformation
            );

            // 7) Update the cart in Commercetools
            const updatedCart = await CommercetoolsCartClient.updateCart(
                ctCart.id,
                ctCart.version,
                updateActions
            );


            // 8) Convert to ICart for the response
            const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(updatedCart);

            const finalRejected = [
                ...initiallyRejectedCoupons,
                ...(finalProcessedCouponEffects.rejectedCoupons || []),
            ];


            const uniqueRejectedByCode = Array.from(
                new Map(finalRejected.map(rc => [rc.code, rc])).values()
            );



            // 9) Return final cart + coupon arrays
            return {
                ...iCart,
                coupons: {
                    acceptedCoupons: finalProcessedCouponEffects.applyCoupons,
                    rejectedCoupons: uniqueRejectedByCode,
                },
                couponsInformation
            };
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }
            throw createStandardizedError(error, 'applyCoupons');
        }
    };

    public getQueryCoupons = async (profileId: any, options: any) => {
        try {
            let data;
            try {
                data = await talonOneIntegrationAdapter.getCustomerInventoryByOptions(
                    profileId,
                    options
                );
            } catch (error: any) {
                logger.info('TalonOne getCustomerInventory error', error);
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: `Error retrieving coupons from TalonOne`,
                    errorCode: 'QUERY_COUPONS_ON_CT_FAIL',
                };
            }

            // filter active coupons coupon_status === true and state === 'active'
            const filterActiveCoupons = (coupons: any[]): any[] => {
                if (!Array.isArray(coupons)) {
                    throw {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: `Error Invalid datatype for coupons`,
                        errorCode: 'QUERY_COUPONS_ON_CT_INVALID_DATATYPE',
                    };
                }
                return coupons.filter((coupon: any) => {
                    return (
                        coupon.attributes?.coupon_status === true &&
                        coupon.state === 'active'
                    );
                });
            };

            // map coupon data
            const mapCouponData = (coupon: any): any => {
                return {
                    value: coupon.value || '',
                    discountPrice: coupon.attributes?.discount_price || 0,
                    discountCode: coupon.attributes?.discount_code || '',
                    couponName: {
                        th: coupon.attributes?.coupon_name_th || '',
                        en: coupon.attributes?.coupon_name_en || '',
                    },
                    marketingName: {
                        th: coupon.attributes?.marketing_name_th || '',
                        en: coupon.attributes?.marketing_name_en || '',
                    },
                    couponShortDetail: {
                        th: coupon.attributes?.coupon_short_detail_th || '',
                        en: coupon.attributes?.coupon_short_detail_en || '',
                    },
                    couponImage: coupon.attributes?.coupon_image || '',
                    termCondition: {
                        th: coupon.attributes?.term_condition_th || '',
                        en: coupon.attributes?.term_condition_en || '',
                    },
                    startDate: coupon.startDate || '',
                    expiryDate: coupon.expiryDate || '',
                };
            };

            const activeCoupons = filterActiveCoupons(data.coupons);
            return activeCoupons.map(mapCouponData);
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'getQueryCoupons');
        }
    };

    private async removeInvalidCouponsFromSession(
        cartId: string,
        currentCouponCodes: string[],
        couponsToRemove: Array<{ code: string; reason: string }>
    ) {
        try {
            const codesToRemove = couponsToRemove.map((rc) => rc.code);

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

    private findPermanentlyInvalidCoupons(processedCouponEffects: any) {
        // Only these reasons are considered “permanently invalid”
        const permanentlyInvalidReasons = [
            COUPON_REJECTION_REASONS.COUPON_NOT_FOUND,
            COUPON_REJECTION_REASONS.COUPON_EXPIRED,
            COUPON_REJECTION_REASONS.COUPON_LIMIT_REACHED,
            COUPON_REJECTION_REASONS.PROFILE_LIMIT_REACHED,
            COUPON_REJECTION_REASONS.COUPON_REJECTED_BY_CONDITION,
        ];
        return (
            processedCouponEffects.rejectedCoupons?.filter((rc: any) =>
                permanentlyInvalidReasons.includes(rc.reason)
            ) || []
        );
    }

    //Add "couponInformation" to cart or remove it if no info is provided. // Should be same function in cart app
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
}
