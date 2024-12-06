export enum CART_JOURNEYS {
    SINGLE_PRODUCT = 'single_product',
    DEVICE_ONLY = 'device_only',
}

export enum CART_INVENTORY_MODES {
    NONE = 'None',
    TRACK_ONLY = 'TrackOnly',
    RESERVE_ON_ORDER = 'ReserveOnOrder',
}

export const CART_EXPIRATION_DAYS = 1;

export const COUPON_CUSTOM_EFFECT = 'coupon_custom_effect';

export const journeyConfigMap: Record<CART_JOURNEYS, any> = {
    [CART_JOURNEYS.SINGLE_PRODUCT]: {},
    [CART_JOURNEYS.DEVICE_ONLY]: {
        inventory: {
            totalKey: 'totalPurchaseStockAllocationDeviceOnly',
            maximumKey: 'maximumStockAllocationDeviceOnly',
        },
    },
}