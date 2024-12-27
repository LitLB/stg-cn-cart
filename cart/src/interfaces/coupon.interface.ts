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