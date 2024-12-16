// cart/src/interfaces/order.ts

import type { Address, Attribute, LocalizedString, ProductTypeReference, ShippingMethodReference } from '@commercetools/platform-sdk';
import { ProductType } from '../types/share.types';

export interface IOrder {
    orderId: string;
    // isPrivilege: boolean;
    campaignGroup: string;
    journey: string;
    // loyaltyTier: string;
    // campaignByJourney: string;
    // propositionGroup: string;
    subtotalPrice: number;
    totalDiscount: number;
    totalPriceAfterDiscount: number;
    // totalVatAmount: number;
    shippingCost: number;
    grandTotal: number;
    currencyCode: string;
    totalQuantity: number;
    shippingAddress: Address | null;
    billingAddress: Address | null;
    shippingMethod: ShippingMethodReference | null;
    paymentMethod: any; // TODO
    quantitiesByProductType: {
        [key: string]: number;
    };
    items: IOrderItem[];
    triggeredCampaigns?: any[];
    appliedEffects?: any[];
    createdAt: Date;
    updatedAt: Date;
}

export interface IOrderItem {
    productId: string;
    productKey?: string;
    productName: LocalizedString;
    ctProductType: ProductTypeReference;
    productSlug?: LocalizedString;
    variantId: number;
    sku: string;
    productType: ProductType;
    productGroup?: number;
    addOnGroup?: string;
    quantity: number;
    unitPrice: number;
    totalUnitPrice: number;
    discountAmount: number;
    priceAfterDiscount: number;
    // vatRate: string;
    // vatAmount: number;
    finalPrice: number;
    appliedEffects?: any[];
    attributes: Attribute[];
    selected: boolean;
    image: IOrderImage | null;
}

export interface IOrderImage {
    url: string;
    label?: string;
}
