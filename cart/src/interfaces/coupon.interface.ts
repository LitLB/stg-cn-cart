// cart/src/interfaces/coupon.interface.ts

export interface ICoupon {
    coupons: {
        acceptedCoupons: Coupon[],
        rejectedCoupons: Coupon[],
    }
}

export interface CouponCustomEffect {
    status: boolean;
    discount_price: number;
    discount_percentage: number;
    discount_code: string;
    other_payment_code: string;
    name_th: string;
    name_en: string;
    marketing_name_th: string;
    marketing_name_en: string;
    coupon_short_detail_th: string;
    coupon_short_detail_en: string;
    term_condition_th: string;
    term_condition_en: string;
}

export interface Coupon {
    code: string,
    reason?: string,
    customEffect?: CouponCustomEffect | null;
}

export interface ProcessedCouponEffect {
    hasCoupons: boolean,
    iCoupons: ICoupon;
    couponCodes: string[],
    acceptedCouponCodes: string[],
    rejectedCouponCodes: string[],
    acceptedCoupons: Coupon[];
    rejectedCoupons: Coupon[];
    acceptedCouponsWithCustomEffects: any[];
    rejectedCouponsWithCustomEffects: any[];
    customEffects: any[];
    couponIdToCode: { [key: number]: string };
    couponIdToEffects: { [key: number]: any[] };
}