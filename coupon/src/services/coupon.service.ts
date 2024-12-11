// coupon/src/services/coupon.service.ts

import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';


export class CouponService {


    constructor() {
        //
    }

    public getQueryCoupons = async (profileId: any, options: any) => {

        const data = await talonOneIntegrationAdapter.getCustomerInventoryByOptions(profileId, options);

        // filter active coupons coupon_status === true and state === 'active'
        const filterActiveCoupons = (coupons: any[]): any[] => {
            return coupons.filter((coupon: any) => {
                return coupon.attributes?.coupon_status === true && coupon.state === 'active';
            });
        }

        // map coupon data
        const mapCouponData = (coupon: any): any => {
            return {
                value: coupon.value || '',
                discountPrice: coupon.attributes?.discount_price || 0,
                discountCode: coupon.attributes?.discount_code || '',
                couponName: {
                    th: coupon.attributes?.coupon_name_th || '',
                    en: coupon.attributes?.coupon_name_en || ''
                },
                marketingName: {
                    th: coupon.attributes?.marketing_name_th || '',
                    en: coupon.attributes?.marketing_name_en || ''
                },
                couponShortDetail: {
                    th: coupon.attributes?.coupon_short_detail_th || '',
                    en: coupon.attributes?.coupon_short_detail_en || ''
                },
                couponImage: coupon.attributes?.coupon_image || '',
                termCondition: {
                    th: coupon.attributes?.term_condition_th || '',
                    en: coupon.attributes?.term_condition_en || ''
                },
                startDate: coupon.startDate || '',
                expiryDate: coupon.expiryDate || ''
            };
        }

        const activeCoupons = filterActiveCoupons(data.coupons);
        return activeCoupons.map(mapCouponData);
    }


}