// interface/cart.ts

import type { Address, Attribute, LocalizedString, ProductTypeReference, ShippingMethodReference } from '@commercetools/platform-sdk';
import { ProductType } from '../types/share.types';

export interface ICart {
	cartId: string;
	locale?: string | null,
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
	items: IItem[];
	triggeredCampaigns?: any[];
	appliedEffects?: any[];
	createdAt: Date;
	updatedAt: Date;
	expiredAt: Date;
	deleteDaysAfterLastModification?: number;
	hasChanged?: any // TODO
}

export interface IItem {
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
	freeGiftGroup?: string;
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
	image: IImage | null;
	inventory?: any;
	hasChanged?: any
}

export interface IImage {
	url: string;
	label?: string;
}


type AddOnType = 'redeem' | 'discount_baht' | 'discount_percentage' | 'subsidy';
type ItemBenefitType = 'discount' | 'other_payment' | 'add_on';

interface ISubsidy {
	otherPaymentCode: string;
	otherPaymentAmount: number;
}

interface IItemBenefit {
	campaignCode?: string;
	discountCode?: string;
	otherPaymentCode?: string;
	promotionSetCode?: string;
	type: ItemBenefitType;
}

interface IAddOnItemBenefit extends IItemBenefit {
	// View
	addOnType: AddOnType;
	maxItem: number;
	group: string;
	addOnProducts: IProductParent[];
	discountBaht?: number;
	discountPercent?: number;
	specialPrice?: number; // TODO: saveOrder ส่ง discount ยังไง
	isForcePromotion: boolean;
	subsidies?: ISubsidy[];
	// Selected
	totalSelectedItem: number;
}

type ItemDiscountType = 'baht' | 'percentage';

interface IDiscountItemBenefit extends IItemBenefit {
	discountType: ItemDiscountType;
	group: string;
	discountAmount: number;
}

type AvailableItemBenefit = IAddOnItemBenefit;
type ChosenItemBenefit = IDiscountItemBenefit | IAddOnItemBenefit;

interface IProductParent {
	productId: string;
	productKey: string;
	variants: IVariant[];
}
interface IVariant {
	productId: string;
	productKey: string;
	variantId: string;
	variantKey: string;
	variantAkeneoId: string;
	sku: string;
	unitPrice: number;
	// View = 0
	quantity: number;
	// Selected = 1,2,3,...
}

export interface CartUpdate {
	sku: string;
	selected?: boolean;
	productId?: string;
	quantity?: number;
	productType?: string;
	productGroup?: number;
}

export interface UpdateItems {
	items: Array<CartUpdate>;
}

export interface ValidateResponse {
	status: boolean;
	limit: number;
}
