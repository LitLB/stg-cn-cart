// coupon/src/services/coupon.service.ts
import { ICart } from '../interfaces/cart';
import { CartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import { talonOneIntegrationAdapter } from '../adapters/talon-one.adapter';
import { readConfiguration } from '../utils/config.utils';

export class CouponService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
    }

    public getCoupons = async (): Promise<any> => {
        return ['a', 'b'];
    };

    public applyCoupons = async (accessToken: string, id: string, body: any): Promise<any> => {
        const couponCodes = body.couponCodes || [];
        let removeCouponCodes = body.removeCouponCodes || [];
        let applyCoupons = [...couponCodes];
        const ctpDefaultCouponLimit = readConfiguration().ctpDefaultCouponLimit ? Number(readConfiguration().ctpDefaultCouponLimit) : undefined;
        if(couponCodes.length > ctpDefaultCouponLimit){
            throw {
                statusCode: 400,
                errorCode: "EXCEEDED_MAX_APPLIYED_COUPON",
                statusMessage: 'exceeded limit',
            };
        }

        const customerSession = await talonOneIntegrationAdapter.getCustomerSession(id);
        if(couponCodes.length > 0 && customerSession['customerSession']['couponCodes'] && customerSession['customerSession']['couponCodes'].length > 0){
            applyCoupons = [...couponCodes, ...customerSession['customerSession']['couponCodes']];
            applyCoupons = Array.from(new Set(applyCoupons));
        }

        removeCouponCodes = customerSession['effects']
            .filter(effect => effect.effectType === "rejectCoupon" && !couponCodes.includes(effect.props.value))
            .map(effect => effect.props.value);
        if(applyCoupons.length > ctpDefaultCouponLimit){
            throw {
                statusCode: 400,
                errorCode: "EXCEEDED_MAX_APPLIYED_COUPON",
                statusMessage: 'exceeded limit',
            };
        }

        if(removeCouponCodes.length > 0){
            applyCoupons = applyCoupons.filter(item => !removeCouponCodes.includes(item));
        }

        couponCodes.splice(0, couponCodes.length, ...applyCoupons);
        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
        const cart = await commercetoolsMeCartClient.getCartById(id);
        if (!cart) {
            throw {
                statusCode: 404,
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
        const updatedCart = await CommercetoolsCartClient.updateCart(
            cart.id,
            cart.version,
            updateActions,
        );

        const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(updatedCart);
        return { ...iCart, rejectedCoupons: processedCouponEffects.rejectedCoupons, acceptedCoupons: processedCouponEffects.acceptedCoupons};
    }
}