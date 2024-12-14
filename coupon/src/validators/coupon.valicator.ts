import { readConfiguration } from '../utils/config.utils';
import { ApiResponse } from '../types/response.type';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export function validateCouponLimit(
	applyCouponsQuantity: number,
): void | ApiResponse {

	// Read configuration for coupon limit
    const config = readConfiguration();
    const ctpDefaultCouponLimit = config.ctpDefaultCouponLimit ? Number(config.ctpDefaultCouponLimit) : undefined;

	// Validate coupon limit
	if (ctpDefaultCouponLimit !== undefined && applyCouponsQuantity > ctpDefaultCouponLimit) {
		logger.info(`'Config limit ${ctpDefaultCouponLimit} error : exceeded limit`);
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
            errorCode: "EXCEEDED_MAX_APPLIYED_COUPON",
			statusMessage: 'exceeded limit',
		};
	}
}