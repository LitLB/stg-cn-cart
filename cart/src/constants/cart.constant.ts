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
    [CART_JOURNEYS.SINGLE_PRODUCT]: {
        inventory: {
            dummyKey: 'dummyStock',
            dummyPurchaseKey: 'dummyPurchase',
        },
    },
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

export enum CART_HAS_CHANGED_NOTICE_MESSAGE  {
    UNPUBLISH_PRODUCT = "The cart items have changed; some items have been removed, and the course items have been unpublished.",
    OUT_OF_STOCK = "The items in the cart have changed; some have been removed, and the stock type has been updated.",
    DUMMY_TO_PHYSICAL_OUT_OF_STOCK = "The items in the cart have changed; some have been removed, and insufficient stock item in cart > available",
    DUMMY_TO_PHYSICAL_INSUFFICIENT_STOCK = "Cart change type from Dummy to physical, but insufficient stock item in cart > available",
    DUMMY_TO_PHYSICAL = "Cart change type from Dummy to physical.",
}
