// coupon/src/validators/coupon.validator.ts

import { ApiResponse } from '../types/response.type';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';

export async function validateCouponLimit(
	applyCouponsQuantity: number,
	removeCoupnsQuantity = 0 
): Promise<void | ApiResponse> {


	// Get Config form CT Custom object client
	const couponLimitConfig = await CommercetoolsCustomObjectClient.getCouponLimit()
	// Validate coupon limit undefined
	if (couponLimitConfig.limitCoupon === undefined) {
		logger.info(`Config limit coupon error : undefined limit coupon`);
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
			errorCode: "UNDEFINED_LIMIT_COUPON",
			statusMessage: 'undefined limit coupon',
		};
	}

    // Validate coupon limit < applyCouponQuantity
    if (couponLimitConfig.limitCoupon < applyCouponsQuantity && removeCoupnsQuantity === 0) {
        logger.info(`'Coupon limit ${couponLimitConfig.limitCoupon} error : exceeded limit`);
        throw {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            errorCode: "EXCEEDED_MAX_APPLIYED_COUPON",
            statusMessage: 'exceeded limit',
        };
    }
	
}

export async function validateCouponDiscount(
	couponsInformation: any[],
	amount: number
  ): Promise<boolean> {
	if (couponsInformation.length === 0) return true;
  
	// Grouping the coupons by their discount type
	const discountTypes: string[] = couponsInformation.map(coupon => coupon.discountCode?.toLowerCase() !== 'null'  ? 'discountCode' : 'otherPaymentCode');
	const discounts: number[] = couponsInformation.map(coupon => coupon.discountPrice);

	// Early exit if there are no discounts
	if (discounts.length === 0) return true;
  
	// Calculate total discount sum
	const sumDiscount = discounts.reduce((acc, curr) => acc + curr, 0);
	let isValid: boolean = true;
	if (!discountTypes.includes('discountCode')) {
	  isValid = (sumDiscount*100) <= amount; // No discountCode: Validate that the sum is not greater than the amount
	} else if (!discountTypes.includes('otherPaymentCode')) { 
	  isValid = (sumDiscount*100) < amount; // No otherPaymentCode: Validate that the sum is less than the amount
	} else {
	  isValid = (sumDiscount*100) <= amount; // Both discountCode and otherPaymentCode are included: Validate that the sum is not greater than the amount
	}

  	return isValid
  }