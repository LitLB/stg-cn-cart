import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { ApiResponse } from '../interfaces/response.interface';

export async function validateCouponLimit(
	applyCouponsQuantity: number,
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
    if (couponLimitConfig.limitCoupon < applyCouponsQuantity) {
        logger.info(`'Coupon limit ${couponLimitConfig.limitCoupon} error : exceeded limit`);
        throw {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            errorCode: "EXCEEDED_MAX_APPLIYED_COUPON",
            statusMessage: 'exceeded limit',
        };
    }
	
}