import { Cart, LineItem, Product } from "@commercetools/platform-sdk";
import { PromotionBundleResponse } from "./promotion-bundle.interface";
import { IHeadlessCheckEligibleResponse } from "./response.interface";

export interface AddItemToCartParams {
    cart: Cart;
    productId: string;
    variantId: number;
    quantity: number;
    productType: string;
    productGroup: number;
    addOnGroup?: string | null;
    freeGiftGroup?: string | null;
    externalPrice: {
        currencyCode: string;
        centAmount: number;
    };
    dummyFlag: boolean,
    campaignVerifyValues: {
        name: string;
        value: string;
    }[];
    journey: string;
    promotionSetInfo?: Product | null;
    bundleProductInfo?: Product | null;
    promotionBundle?: PromotionBundleResponse['data'] | null;
    eligibleProductBundle?: IHeadlessCheckEligibleResponse | null;
}

export interface UpdateDiscountNoCampaignToCartParams {
    cart: Cart;
    lineItem: LineItem;
    promotionBundle: PromotionBundleResponse['data'][0];
}

export interface UpdateDiscountCampaignToCartParams {
    cart: Cart;
    lineItem: LineItem;
    promotionBundle: IHeadlessCheckEligibleResponse;
}

export interface AddDirectDiscountParams {
    sku: string
    cart: Cart
    discountAmount?: number
    quantity?: number
}