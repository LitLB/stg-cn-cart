import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { logger } from '../utils/logger.utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { FUNC_CHECKOUT } from '../constants/func.constant';

export async function validateCouponLimit(
	applyCouponsQuantity: number,
	func?: string
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

		if(func === FUNC_CHECKOUT){
			return {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                errorCode: "EXCEEDED_MAX_APPLIYED_COUPON_CHECKOUT",
                statusMessage: 'coupon has changed',
            };
		}

        throw {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            errorCode: "EXCEEDED_MAX_APPLIYED_COUPON",
            statusMessage: 'exceeded limit',
        };
    }
	
}

export async function validateCouponDiscount(
	ctCart: any,
	couponsInformation: any,
	func?: string
): Promise<void | ApiResponse> {
	const totalPrice: any = ctCart.lineItems.map((item: any) => {return item.totalPrice})
	const totalAmount: number = totalPrice.reduce((sum: number, price: any) => sum + price.centAmount, 0);
	const sumDiscount: number = couponsInformation.reduce((acc: number, curr: any) => acc + curr.discountPrice, 0);
	const discountTypes: string[] = couponsInformation.map((coupon: any) => coupon.discountCode?.toLowerCase() !== 'null' ? 'discountCode' : 'otherPaymentCode');

	let isValid: boolean = true;
  
	if (!discountTypes.includes('discountCode')) {
	  isValid = (sumDiscount*100) <= totalAmount; // No discountCode: Validate that the sum is not greater than the amount
	} else if (!discountTypes.includes('otherPaymentCode')) { 
	  isValid = (sumDiscount*100) < totalAmount; // No otherPaymentCode: Validate that the sum is less than the amount
	} else {
	  isValid = (sumDiscount*100) <= totalAmount; // Both discountCode and otherPaymentCode are included: Validate that the sum is not greater than the amount
	}

    if (!isValid) {
        logger.info(`'Coupon discount error : exceeded discount`);

		if(func === FUNC_CHECKOUT){
			return {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                errorCode: "EXCEEDED_MAX_APPLIYED_COUPON_DISCOUNT_CHECKOUT",
                statusMessage: 'coupon has changed',
            };
		}
    }
	
}