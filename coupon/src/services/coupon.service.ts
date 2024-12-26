// coupon/src/services/coupon.service.ts
import { ICart } from '../interfaces/cart';
import { CartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { validateCouponLimit } from '../validators/coupon.validator';
import { logger } from '../utils/logger.utils';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export class CouponService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
    }

    public applyCoupons = async (accessToken: string, id: string, body: any): Promise<any> => {
        try {
            // 1) Grab new codes from the request body
            const couponCodes = body.couponCodes || [];
            const removeCouponCodes = body.removeCouponCodes || [];

            // Validate coupon limit (if your business limits how many codes can be applied)
            const validateError = validateCouponLimit(couponCodes.length);
            if (validateError) {
                throw validateError;
            }

            // 2) Manage coupon codes in Talon.One session: merges duplicates, removes user-requested removals, etc.
            const resultCoupons = await talonOneIntegrationAdapter.manageCouponsById(
                id,
                couponCodes,
                removeCouponCodes
            );
            if (resultCoupons.error) {
                throw resultCoupons.error;
            }
            // Overwrite couponCodes with the result after manageCouponsById
            couponCodes.splice(0, couponCodes.length, ...resultCoupons.applyCoupons);

            // 3) Get the Commercetools cart
            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
            const cart = await commercetoolsMeCartClient.getCartById(id);
            if (!cart) {
                logger.info('Commercetools getCartById error');
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    errorCode: "APPLIYED_COUPON_CT_FAILED",
                    statusMessage: 'Cart not found or has expired',
                };
            }

            // 4) Build customer session payload & update Talon.One for final coupon effects
            const profileId = cart?.id;
            const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                profileId,
                ctCartData: cart,
                couponCodes,
            });

            let updatedCustomerSession;
            try {
                updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(
                    profileId,
                    customerSessionPayload
                );
            } catch (error: any) {
                logger.info('TalonOne updateCustomerSession error', error);
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    errorCode: "APPLIYED_COUPON_CT_FAILED",
                    statusMessage: `An error occurred while updateCustomerSession from talonOne.`,
                };
            }

            // 5) Process the returned effects: accepted & rejected coupons
            const talonEffects = updatedCustomerSession.effects;
            const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(talonEffects);

            // =============================================================================
            // ADDED / UPDATED (Case #2): Auto-remove "permanently invalid" coupons
            // =============================================================================
            // Identify coupons that are definitely NOT fixable (e.g., NotFound, Expired).
            // You can add or remove reasons depending on your business logic.
            const permanentlyInvalidCoupons = processedCouponEffects.rejectedCoupons?.filter((rc) => {
                return ['CouponNotFound', 'CouponExpired'].includes(rc.reason);
            }) || [];

            if (permanentlyInvalidCoupons.length > 0) {
                // We'll remove them immediately so they don't persist in the cart.
                const codesToRemove = permanentlyInvalidCoupons.map((rc) => rc.code);

                // Push them onto the remove list
                removeCouponCodes.push(...codesToRemove);

                // Re-run manageCouponsById to forcibly remove them from the session
                const resultCouponsAfterRemoval =
                    await talonOneIntegrationAdapter.manageCouponsById(id, couponCodes, removeCouponCodes);

                if (resultCouponsAfterRemoval.error) {
                    throw resultCouponsAfterRemoval.error;
                }

                // Overwrite the local couponCodes array so it no longer includes the removed ones
                couponCodes.splice(0, couponCodes.length, ...resultCouponsAfterRemoval.applyCoupons);

                // Optionally, you could call "updateCustomerSession" again to get a
                // "clean" session with no references to the invalid coupon codes,
                // but that’s optional. If you'd like, do something like:
                
                const newSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                    profileId,
                    ctCartData: cart,
                    couponCodes,
                });
                updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(profileId, newSessionPayload);
                //
                // Then re-process the effects, etc. (Usually not strictly required.)
            }
            // =============================================================================
            // END ADDED / UPDATED
            // =============================================================================

            // 6) Build final cart update actions from the coupon effects
            const talonOneUpdateActions = this.talonOneCouponAdapter.buildCouponActions(cart, processedCouponEffects);
            const updateActions: CartUpdateAction[] = [...talonOneUpdateActions];

            // 7) Update the cart in Commercetools with any discount line items, etc.
            const updatedCart = await CommercetoolsCartClient.updateCart(cart.id, cart.version, updateActions);

            // 8) Convert to ICart for the response
            const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(updatedCart);

            // 9) Return final cart object + the coupon arrays
            //    The FE sees "rejectedCoupons" once. On the next GET, they won't appear if
            //    they've been removed above.
            return {
                ...iCart,
                coupons: {
                    acceptedCoupons: processedCouponEffects.applyCoupons,
                    rejectedCoupons: processedCouponEffects.rejectedCoupons,
                },
            };
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'applyCoupons');
        }
    }

    public getQueryCoupons = async (profileId: any, options: any) => {
        try {
            let data;
            try {
                data = await talonOneIntegrationAdapter.getCustomerInventoryByOptions(profileId, options);
            } catch (error: any) {
                logger.info('TalonOne getCustomerInventory error', error);
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: `Error retrieving coupons from TalonOne`,
                    errorCode: 'QUERY_COUPONS_ON_CT_FAIL',
                }
            }

            // filter active coupons coupon_status === true and state === 'active'
            const filterActiveCoupons = (coupons: any[]): any[] => {
                if (!Array.isArray(coupons)) {
                    throw {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: `Error Invalid datatype for coupons`,
                        errorCode: 'QUERY_COUPONS_ON_CT_INVALID_DATATYPE',
                    }
                }
                return coupons.filter((coupon: any) => {
                    return coupon.attributes?.coupon_status === true && coupon.state === 'active';
                });
            }

            // map coupon data
            const mapCouponData = (coupon: any): any => {
                return {
                    value: coupon.value || '',
                    discountPrice: coupon.attributes?.discount_price || 0,
                    discountCode: coupon.attributes?.discount_code || '',
                    couponName: {
                        th: coupon.attributes?.coupon_name_th || '',
                        en: coupon.attributes?.coupon_name_en || ''
                    },
                    marketingName: {
                        th: coupon.attributes?.marketing_name_th || '',
                        en: coupon.attributes?.marketing_name_en || ''
                    },
                    couponShortDetail: {
                        th: coupon.attributes?.coupon_short_detail_th || '',
                        en: coupon.attributes?.coupon_short_detail_en || ''
                    },
                    couponImage: coupon.attributes?.coupon_image || '',
                    termCondition: {
                        th: coupon.attributes?.term_condition_th || '',
                        en: coupon.attributes?.term_condition_en || ''
                    },
                    startDate: coupon.startDate || '',
                    expiryDate: coupon.expiryDate || ''
                };
            }

            const activeCoupons = filterActiveCoupons(data.coupons);
            return activeCoupons.map(mapCouponData);
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'getQueryCoupons');
        }
    }
}