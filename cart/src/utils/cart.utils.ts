import { Cart } from "@commercetools/platform-sdk";
import { ICart } from "../interfaces/cart";

export const updateCartFlag = (iCart: ICart): ICart => {

    const { items } = iCart;

    if (items.length <= 0) return { ...iCart, preOrder: false }

    return iCart
}

// TODO :: IMPROVE LOGIC OUT OF STOCK !!
export const validateInventory = (inventory: any) => {
    const { stock } = inventory
    const { available, totalAvailableDummyStock, totalAvailableDummyPurchaseStock } = stock
    const quantityGTtotalAvailableDummyPurchaseStock = totalAvailableDummyPurchaseStock < totalAvailableDummyStock

    return {
        available,
        isOutOfStock: available <= 0,
        isDummyStock: available <= 0 && totalAvailableDummyStock > 0 && quantityGTtotalAvailableDummyPurchaseStock || false,
    }
}


export const comparePdpData = (data: any, ctCart: Cart) => {
    const isEqual = true;
    const productInfo = ctCart.lineItems.filter((lineItem) => lineItem.custom?.fields?.productType !== 'bundle' && lineItem.custom?.fields?.productType !== 'sim')
    console.log('productInfo :', productInfo)
    return { isEqual: isEqual, dataChange: {}}
}
export const compareSelectNumberData = (data: any, ctCart: Cart) => {
    const isEqual = true;
    const simInfo = ctCart.lineItems.filter((lineItem) => lineItem.custom?.fields?.productType == 'sim')
    console.log('simInfo :', simInfo)
    return { isEqual: isEqual, dataChange: {}}
}
export const compareVerificationData = (data: any, ctCart: Cart) => {
    const isEqual = true;
    const verifyInfo = {};
    console.log('verifyInfo :', verifyInfo)
    return { isEqual: isEqual, dataChange: {}}
}
export const compareConsentData = (data: any, ctCart: Cart) => {
    const isEqual = true;
    const consentInfo = {};
    console.log('consentInfo :', consentInfo)
    return { isEqual: isEqual, dataChange: {}}
}
export const compareOfferData = (data: any, ctCart: Cart) => {
    const isEqual = true;
    const packageInfo = ctCart.lineItems.filter((lineItem) => lineItem.custom?.fields?.productType == 'bundle')
    console.log('packageInfo :', packageInfo)
    return { isEqual: isEqual, dataChange: {}}
}
export const compareEkycData = (data: any, ctCart: Cart) => {
    const isEqual = true;
    const eKycInfo = {};
    console.log('eKycInfo :', eKycInfo)
    return { isEqual: isEqual, dataChange: {}}
}
export const compareBillingInfoAddressData = (data: any, ctCart: Cart) => {
    const isEqual = true;
    const billingInfo = {};
    console.log('billingInfo :', billingInfo)
    return { isEqual: isEqual, dataChange: {}}
}