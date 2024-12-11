import { readConfiguration } from '../utils/config.utils';
import { ResponseType } from '../types/response.type';

export function validateCouponLimit(
	applyCouponsQuantity: number,
): void | ResponseType {

	// Read configuration for coupon limit
    const config = readConfiguration();
    const ctpDefaultCouponLimit = config.ctpDefaultCouponLimit ? Number(config.ctpDefaultCouponLimit) : undefined;

	// Validate coupon limit
	if (ctpDefaultCouponLimit !== undefined && applyCouponsQuantity > ctpDefaultCouponLimit) {
		throw {
			statusCode: 400,
            errorCode: "EXCEEDED_MAX_APPLIYED_COUPON",
			statusMessage: 'exceeded limit',
		};
	}
}