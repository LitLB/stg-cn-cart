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

    public getCoupons = async (): Promise<any> => {
        return ['a', 'b'];
    };

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
        // const updateActions: any[] = [];
        // updateActions.push(...talonOneUpdateActions);
        const coupons = {
            acceptedCoupons: processedCouponEffects.applyCoupons,
            rejectedCoupons: processedCouponEffects.rejectedCoupons
        }
        // if (coupons) {
        //     updateActions.push({
        //         action: 'setCoupons',
        //         address: coupons,
        //     });
        // }
        updateActions.push(...talonOneUpdateActions);
        const updatedCart = await CommercetoolsCartClient.updateCart(
            cart.id,
            cart.version,
            updateActions,
        );

        const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(updatedCart);
        return { ...iCart, coupons };
    }
}