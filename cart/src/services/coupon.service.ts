
// TODO Move to new folder

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
                discountPrice: coupon.attributes?.discount_price || coupon.attributes?.discountPrice || '', // TODO need change when discount_price constant change
                discountCode: coupon.attributes?.discount_code || '',
                couponName: coupon.attributes?.coupon_name || '',
                marketingName: coupon.attributes?.marketing_name || '',
                couponShortDetail: coupon.attributes?.coupon_short_detail || '',
                couponImage: coupon.attributes?.coupon_image || '',
                termCondition: coupon.attributes?.term_condition || '',
                startDate: coupon.startDate || '',
                expiryDate: coupon.expiryDate || ''
            };
        }

        const activeCoupons = filterActiveCoupons(data.coupons);
        return activeCoupons.map(mapCouponData);
    }


}