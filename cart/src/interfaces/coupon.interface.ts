export interface ICoupon {
    coupons: {
        acceptedCoupons: Coupon[],
        rejectedCoupons: Coupon[],
    }
}

export interface Coupon {
    code: string,
    reason?: string,
}

export interface ProcessedCouponEffect {
    thereIsCoupons: boolean,
    couponCodes: string[],
    acceptedCouponCodes: string[],
    rejectedCouponCodes: string[],
    acceptedCoupons: Coupon[];
    rejectedCoupons: Coupon[];
    customEffects: any[];
    couponIdToCode: { [key: number]: string };
    couponIdToEffects: { [key: number]: any[] };
}