// coupon/src/services/coupon.service.ts
import { ICart } from '../interfaces/cart';
import { CartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { validateCouponLimit } from '../validators/coupon.valicator';


export class CouponService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
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

    public applyCoupons = async (accessToken: string, id: string, body: any): Promise<any> => {
        const couponCodes = body.couponCodes || [];
        const removeCouponCodes = body.removeCouponCodes || [];
        
        const validateError = validateCouponLimit(couponCodes.length)
        if(validateError){
            throw validateError;
        }

        const resultCoupons = await talonOneIntegrationAdapter.manageCouponsById(id, couponCodes, removeCouponCodes)
        if(resultCoupons.error){
            throw resultCoupons.error;
        }

        // Update couponCodes in-place
        couponCodes.splice(0, couponCodes.length, ...resultCoupons.applyCoupons);
        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
        const cart = await commercetoolsMeCartClient.getCartById(id);
        if (!cart) {
            throw {
                statusCode: 404,
                errorCode: "APPLIYED_COUPON_CT_FAILED",
                statusMessage: 'Cart not found or has expired',
            };
        }
        
        const profileId = cart?.id
        const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({ profileId, ctCartData: cart, couponCodes });
        const updatedCustomerSession = await talonOneIntegrationAdapter.updateCustomerSession(profileId, customerSessionPayload);
        const talonEffects = updatedCustomerSession.effects;
        const processedCouponEffects = this.talonOneCouponAdapter.processCouponEffects(talonEffects);
        const talonOneUpdateActions = this.talonOneCouponAdapter.buildCouponActions(cart, processedCouponEffects);
        const updateActions: CartUpdateAction[] = [];
        updateActions.push(...talonOneUpdateActions);
        const coupons = {
            acceptedCoupons: processedCouponEffects.applyCoupons,
            rejectedCoupons: processedCouponEffects.rejectedCoupons
        }
        const updatedCart = await CommercetoolsCartClient.updateCart(
            cart.id,
            cart.version,
            updateActions,
        );

        const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(updatedCart);
        return { ...iCart, coupons };
    }
}