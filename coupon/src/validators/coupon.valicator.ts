import { readConfiguration } from '../utils/config.utils';
import { ResponseType } from '../types/response.type';
import { logger } from '../utils/logger.utils';

export function validateCouponLimit(
	applyCouponsQuantity: number,
): void | ResponseType {

	// Read configuration for coupon limit
    const config = readConfiguration();
    const ctpDefaultCouponLimit = config.ctpDefaultCouponLimit ? Number(config.ctpDefaultCouponLimit) : undefined;

	// Validate coupon limit
	if (ctpDefaultCouponLimit !== undefined && applyCouponsQuantity > ctpDefaultCouponLimit) {
		logger.info(`'Config limit ${ctpDefaultCouponLimit} error : exceeded limit`);
		throw {
			statusCode: 400,
            errorCode: "EXCEEDED_MAX_APPLIYED_COUPON",
			statusMessage: 'exceeded limit',
		};
	}
}