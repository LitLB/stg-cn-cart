import { Cart, Product } from "@commercetools/platform-sdk";

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
}