import { Cart } from "@commercetools/platform-sdk";

export interface calculateProductGroupParams {
    cart: Cart;
    productId: string;
    sku: string;
    productType: string;
    productGroup?: number;
}