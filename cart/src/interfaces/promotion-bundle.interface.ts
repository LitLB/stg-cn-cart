export interface PromotionBundleResponse {
    statusCode: string;
    statusMessage: string;
    data: BundleData[];
}

export interface BundleData {
    bundleKey: string;
    prices: BundlePrices;
    promotionSetInfo: PromotionSetInfo;
    promotionProductGroups: PromotionProductGroup[];
    promotionProducts: PromotionProduct[];
    promotionDetails: PromotionDetail[];
    promotionPackageInfos: PromotionPackageInfo[];
}

export interface BundlePrices {
    rrp: string;
    totalDiscount: string;
    discounted: string;
    discounts: Discount[];
}

export interface Discount {
    group: string;
    type: string;
    code: string;
    amount: string;
}

export interface PromotionSetInfo {
    id: string;
    version: number;
    versionModifiedAt: string;
    lastMessageSequenceNumber: number;
    createdAt: string;
    lastModifiedAt: string;
    lastModifiedBy: ClientInfo;
    createdBy: ClientInfo;
    productType: TypeReference;
    masterData: MasterData;
    masterVariant: Variant;
    key: string;
    lastVariantId: number;
}

export interface ClientInfo {
    clientId: string;
    isPlatformClient: boolean;
}

export interface TypeReference {
    typeId: string;
    id: string;
}

export interface MasterData {
    current: ProductData;
    staged: ProductData;
    published: boolean;
    hasStagedChanges: boolean;
}

export interface ProductData {
    name: LocalizedString;
    description: LocalizedString;
    categories: any[];
    categoryOrderHints: Record<string, any>;
    slug: LocalizedString;
    masterVariant: Variant;
    variants: any[];
    searchKeywords: Record<string, any>;
    attributes: any[];
}

export interface LocalizedString {
    [locale: string]: string;
}

export interface Variant {
    id: number;
    sku: string;
    key: string;
    prices: any[];
    images: any[];
    attributes: Attribute[];
    assets: any[];
}

export interface Attribute {
    name: string;
    value: string | boolean | string[];
}

export interface PromotionProductGroup {
    id: string;
    version: number;
    versionModifiedAt: string;
    createdAt: string;
    lastModifiedAt: string;
    lastModifiedBy: ClientInfo;
    createdBy: ClientInfo;
    container: string;
    key: string;
    value: PromotionProductGroupValue;
}

export interface PromotionProductGroupValue {
    code: string;
    promotionSetCode: string;
    groupCode: string;
    variants: PromotionVariant[];
}

export interface PromotionVariant {
    variant: string;
    discountBaht?: string;
    discountPercent?: string;
    minBuy?: number;
    haveOtp?: boolean;
    forcePromotion?: boolean;
    type: string;
    otherPayments?: any[];
}

export interface PromotionProduct {
    id: string;
    version: number;
    versionModifiedAt: string;
    createdAt: string;
    lastModifiedAt: string;
    lastModifiedBy: ClientInfo;
    createdBy: ClientInfo;
    container: string;
    key: string;
    value: PromotionProductValue;
}

export interface PromotionProductValue {
    code: string;
    promotionSetCode: string;
    variant: string;
    discountBaht: string;
    discountPercent: string;
    minBuy: number;
    haveOtp: boolean;
    forcePromotion: boolean;
    type: string;
    params: any[];
}

export interface PromotionDetail {
    id: string;
    version: number;
    versionModifiedAt: string;
    createdAt: string;
    lastModifiedAt: string;
    lastModifiedBy: ClientInfo;
    createdBy: ClientInfo;
    container: string;
    key: string;
    value: PromotionDetailValue;
}

export interface PromotionDetailValue {
    code: string;
    promotionSetCode: string;
    groupCode: string;
    variants: PromotionDetailVariant[];
    promotionType: string;
    maxItems: number;
    discountBaht: string;
    discountPercent: string;
    specialPrice: string;
    forcePromotion: boolean;
    otherPayments: any[];
}

export interface PromotionDetailVariant {
    variant: string;
    type: string;
}

export interface PromotionPackageInfo {
    id: string;
    masterData: PackageMasterData;
    productType: TypeReference;
    taxCategory?: TypeReference;
    version: number;
    createdAt: string;
    lastModifiedAt: string;
}

export interface PackageMasterData {
    current: PackageData;
    hasStagedChanges: boolean;
    published: boolean;
    staged: PackageData;
}

export interface PackageData {
    categories: TypeReference[];
    description: LocalizedString;
    masterVariant: PackageVariant;
    name: LocalizedString;
    slug: LocalizedString;
    variants: any[];
    searchKeywords: Record<string, any>;
}

export interface PackageVariant {
    attributes: any[];
    id: number;
    images: Image[];
    prices: Price[];
    sku: string;
}

export interface Image {
    dimensions: Dimensions;
    url: string;
}

export interface Dimensions {
    h: number;
    w: number;
}

export interface Price {
    value: PriceValue;
    id: string;
}

export interface PriceValue {
    type: string;
    fractionDigits: number;
    centAmount: number;
    currencyCode: string;
}
