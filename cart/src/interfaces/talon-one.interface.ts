// cart/src/interfaces/talon-one.interface.ts

import { ProductType } from "../types/share.types";

type State = 'open' | 'closed' | 'cancelled' | 'partially_returned';

interface ICustomerSessionAttributes {
  campaign_group?: string;
  journey?: string;
  rc?: number;
}

interface ICartItem {
  sku: string;
  quantity: number;
  price: number;
  attributes?: ICartItemAttributes;
}

interface ICartItemAttributes {
  product_type: ProductType;
  product_group: number
  add_on_group: string
}

export interface ICustomerSession {
  state?: State;
  profileId?: string;
  attributes?: ICustomerSessionAttributes;
  cartItems: ICartItem[];
}

export enum COUPON_REJECTION_REASONS {
  PROFILE_LIMIT_REACHED = "ProfileLimitReached",
  COUPON_LIMIT_REACHED= "CouponLimitReached",
  COUPON_NOT_FOUND = "CouponNotFound",
  COUPON_EXPIRED = "CouponExpired",
  COUPON_REJECTED_BY_CONDITION = "CouponRejectedByCondition",
}