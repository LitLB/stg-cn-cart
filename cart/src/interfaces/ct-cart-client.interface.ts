import { Cart, LineItem } from "@commercetools/platform-sdk";
import { PromotionBundleResponse } from "./promotion-bundle.interface";

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
    promotionBundle?: PromotionBundleResponse['data'] | null
}

export interface UpdateDiscountNoCampaignToCartParams {
    cart: Cart;
    lineItem: LineItem;
    promotionBundle: PromotionBundleResponse['data'][0]
}

export interface AddDirectDiscountParams {
    sku: string
    cart: Cart
    totalDiscount: number
}