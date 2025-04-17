// coupon/src/services/coupon.service.ts

import { ICart } from '../interfaces/cart';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { validateCouponLimit, validateCouponDiscount } from '../validators/coupon.validator';
import { logger } from '../utils/logger.utils';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { COUPON_REJECTION_REASONS } from '../constants/talon-one.interface';
import {
    CartSetCustomFieldAction,
    CartUpdateAction
} from '@commercetools/platform-sdk';
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

    public applyCoupons = async (
        accessToken: string,
        id: string,
        body: any
    ): Promise<any> => {
        try {
            // 1) Grab new codes from the request body
            let couponCodes = body.couponCodes || [];
            const removeCouponCodes = body.removeCouponCodes || [];

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

            const customerSession = await talonOneIntegrationAdapter.getCustomerSession(id);

            // *** condition ***
            let cartInfoForCouponValidation: any = await this.getCartInfoForCouponValidation(ctCart)
            // Get Current Effects
            const { acceptedCoupons: acceptedCouponsOld, isAllowStackingCouponCart, notAllowStackingCouponId } = this.talonOneCouponAdapter.processCouponEffects(customerSession.effects, cartInfoForCouponValidation);

            cartInfoForCouponValidation = {
                ...cartInfoForCouponValidation,
                isAllowStackingCouponCart,
                notAllowStackingCouponId
            }

            // Validate coupon limit
            const validateError = await validateCouponLimit(couponCodes.length, removeCouponCodes.length);

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
            couponCodes = [...resultCoupons.applyCoupons]

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
            const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(updatedCustomerSession.effects, cartInfoForCouponValidation);

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
                couponCodes = [...removeResult.applyCoupons]

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
            const finalProcessedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(finalEffects, cartInfoForCouponValidation);
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
                couponsInformation,
                acceptedCouponsOld,
            };
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }
            throw createStandardizedError(error, 'applyCoupons');
        }
    };

    public getQueryCoupons = async (profileId: any, filter: any, options: any) => {
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
            const activeCoupons = this.filterActiveCoupons(data.coupons);
            const mappedCoupons = activeCoupons
                .filter((activeCoupon: any) => this.couponFilter(activeCoupon, filter))
                .map(this.mapCouponData);

            return mappedCoupons;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'getQueryCoupons');
        }
    };

    private filterActiveCoupons(coupons: any[]): any[] {
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
    private mapCouponData(coupon: any) {
        return {
            value: coupon.value || '',
            discountPrice: coupon.attributes?.discount_price || 0,
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
            minimumPurchase: coupon.attributes?.minimum_purchase ?? [],
            allowStacking: coupon.attributes?.allow_stacking ?? false,
            loyaltyGroups: coupon.attributes?.loyalty_groups ?? [],
            customerTypes: coupon.attributes?.customer_types ?? [],
            allowedPackages: coupon.attributes?.allowed_packages ?? [],
            excludedPackages: coupon.attributes?.excluded_packages ?? [],
            startDate: coupon.startDate || '',
            expiryDate: coupon.expiryDate || '',
        };
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

    //Get Price and Coupon information then validate excessed discount
    public checkCouponDiscount = async (
        accessToken: string,
        id: string,
        cart: any,
        body: any
    ): Promise<any> => {
        try {
            const { couponsInformation, subtotalPrice, acceptedCouponsOld } = cart;

            const validateDiscount = await validateCouponDiscount(couponsInformation, subtotalPrice);

            if (!validateDiscount) {
                const couponCodes = acceptedCouponsOld;
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

                const clearCouponsPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
                    profileId: ctCart.id,
                    ctCartData: ctCart,
                    couponCodes: couponCodes,
                });
                const clearCouponsUpdatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(
                    ctCart.id,
                    clearCouponsPayload
                );

                const cartInfoForCouponValidation = await this.getCartInfoForCouponValidation(ctCart)

                const clearCouponsEffects = this.talonOneCouponAdapter.processCouponEffects(clearCouponsUpdatedCustomerSession.effects, cartInfoForCouponValidation);
                const { updateActions } = this.talonOneCouponAdapter.buildCouponActions(ctCart, clearCouponsEffects);

                if (updateActions.length > 0) {
                    await CommercetoolsCartClient.updateCart(
                        ctCart.id,
                        ctCart.version,
                        updateActions
                    );
                }

                logger.info('Coupon discount error: exceeded discount');
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    errorCode: 'EXCEEDED_MAX_APPLIED_COUPON_DISCOUNT',
                    statusMessage: 'Exceeded discount',
                };
            }
            return cart;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }
            throw createStandardizedError(error, 'checkCouponDiscount');
        }
    };

    private couponFilter(coupon: any, filter: any) {
        const {
            totalPrice = null,
            allowStacking = null,
            // containsDiscountedProducts = null,
            campaignGroup = null,
            journey = null,
            customerType = null,
            loyaltyGroup = null,
            skus = [],
            series = [],
            brands = [],
            categories = [],
            packageIds = [],
        } = filter;

        const {
            minimum_purchase = 0,
            allow_stacking = false,
            // allow_with_discounted_products = false,
            allowed_campaign_groups: allowedCampaignGroups = [],
            allowed_journeys: allowedJourneys = [],
            customer_types: customerTypes = [],
            loyalty_groups: loyaltyGroups = [],
            allowed_products = [],
            excluded_products = [],
            allowed_series = [],
            excluded_series = [],
            allowed_brands = [],
            excluded_brands = [],
            allowed_categories = [],
            excluded_categories = [],
            allowed_packages = [],
            excluded_packages = [],
        } = coupon?.attributes || {};

        if (totalPrice !== null && totalPrice < minimum_purchase) {
            return false
        }

        if (allowStacking !== null && allowStacking !== allow_stacking) {
            return false
        }

        // if (containsDiscountedProducts !== null && containsDiscountedProducts !== allow_with_discounted_products) {
        //     return false
        // }

        if (campaignGroup !== null && !this.checkInAllowedList([campaignGroup], allowedCampaignGroups)) {
            return false
        }

        if (journey !== null && !this.checkInAllowedList([journey], allowedJourneys)) {
            return false
        }

        if (customerType !== null && !this.checkInAllowedList([customerType], customerTypes)) {
            return false
        }

        if (loyaltyGroup !== null && !this.checkInAllowedList([loyaltyGroup], loyaltyGroups)) {
            return false
        }

        if (!this.checkInAllowedList(skus, allowed_products)) {
            return false
        }

        if (this.checkInExcludedList(skus, excluded_products)) {
            return false
        }

        if (!this.checkInAllowedList(series, allowed_series)) {
            return false
        }

        if (this.checkInExcludedList(series, excluded_series)) {
            return false
        }

        if (!this.checkInAllowedList(brands, allowed_brands)) {
            return false
        }

        if (this.checkInExcludedList(brands, excluded_brands)) {
            return false
        }

        if (!this.checkInAllowedList(categories, allowed_categories)) {
            return false
        }

        if (this.checkInExcludedList(categories, excluded_categories)) {
            return false
        }

        if (!this.checkInAllowedList(packageIds, allowed_packages)) {
            return false
        }

        if (this.checkInExcludedList(packageIds, excluded_packages)) {
            return false
        }

        return true
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

    private calculateLineItemOtherPaymentAmount(lineItem: any, customLineItems: any[]) {
        const lineItemId = lineItem.id

        const otherPaymentCustomLineItems =
            customLineItems.filter((item: any) => item.slug.startsWith(`${lineItemId}-${this.ctpAddCustomOtherPaymentLineItemPrefix}`))
        const lineItemOtherPaymentAmount = otherPaymentCustomLineItems.reduce((acc: number, current: any) => {
            return acc + Math.abs(current?.totalPrice?.centAmount)
        }, 0)

        return lineItemOtherPaymentAmount
    }

    private getCartInfoForCouponValidation = async (ctCart: any) => {
        const campaignGroup = ctCart.custom.fields.campaignGroup
        const journey = ctCart.custom.fields.journey

        const lineItems = ctCart.lineItems
        const customLineItems = ctCart.customLineItems

        const totalPriceAfterCampaignDiscount = lineItems.reduce((total: number, lineItem: any) => {
            const otherPaymentAmount = this.calculateLineItemOtherPaymentAmount(lineItem, customLineItems);
            return total + (lineItem.totalPrice.centAmount - otherPaymentAmount)
        }, 0)

        const allSkus = lineItems.map((item: any) => item.variant.sku)
        const { body } = await this.ctProductClient.getProductsBySkus(allSkus, ['categories[*].parent'])
        const products = body.results;
        const productIdToProducts = products.reduce((acc: any, product: any) => {
            acc[product.id] = product
            return acc
        }, [])

        const filterLineItems = lineItems.map((lineItem: any, lineItemIndex: number) => {
            const lineItemId = lineItem.id
            const productType = lineItem.custom.fields.productType
            const sku = lineItem.variant.sku
            const attributes: any = lineItem?.variant?.attributes?.reduce((acc: any, current: any) => {
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
