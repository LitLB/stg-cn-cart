// cart/src/constants/country.constant.ts

export enum CART_JOURNEYS {
    SINGLE_PRODUCT = 'single_product',
    DEVICE_ONLY = 'device_only',
    DEVICE_BUNDLE_EXISTING = 'device_bundle_existing',
}

export enum CART_INVENTORY_MODES {
    NONE = 'None',
    TRACK_ONLY = 'TrackOnly',
    RESERVE_ON_ORDER = 'ReserveOnOrder',
}

export const CART_EXPIRATION_DAYS = 1;

export const COUPON_CUSTOM_EFFECT = 'coupon_custom_effect_v3';

export const journeyConfigMap: Record<CART_JOURNEYS, any> = {
    [CART_JOURNEYS.SINGLE_PRODUCT]: {},
    [CART_JOURNEYS.DEVICE_ONLY]: {
        inventory: {
            maximumKey: 'maximumStockAllocationDeviceOnly',
            totalKey: 'totalPurchaseStockAllocationDeviceOnly',
            dummyKey: 'dummyStock',
            dummyPurchaseKey: 'dummyPurchase',
        },
    },
    [CART_JOURNEYS.DEVICE_BUNDLE_EXISTING]: {
        inventory: {
            maximumKey: 'maximumStockAllocationDeviceBundleExisting',
            totalKey: 'totalPurchaseStockAllocationDeviceBundleExisting',
            dummyKey: 'dummyStock',
            dummyPurchaseKey: 'dummyPurchase',
        },
    },
}

export enum CART_OPERATOS {
    DTAC = 'DTAC',
    TRUE = 'TRUE',
}
