import { Cart } from "@commercetools/platform-sdk";
import { ICart } from "../interfaces/cart";

export const updateCartFlag = (iCart: ICart): ICart => {

    const { items } = iCart;

    if (items.length <= 0) return { ...iCart, preOrder: false }

    return iCart
}

// TODO :: IMPROVE LOGIC OUT OF STOCK !!
export const validateInventory = (inventory: any) => {

    const { stock,custom } = inventory

    const { fields } = custom

    const { dummyStock} = fields

    const { available, totalAvailableDummyStock, totalAvailableDummyPurchaseStock } = stock

    const quantityGTtotalAvailableDummyPurchaseStock = totalAvailableDummyPurchaseStock < totalAvailableDummyStock

    if(dummyStock === undefined){ 
        return {
            available,
            isOutOfStock: available <= 0,
            isDummyStock: available <= 0 && dummyStock === undefined
        }
    } 

    return {
        available,
        isOutOfStock: available <= 0,
        isDummyStock: available <= 0 && totalAvailableDummyStock > 0 && quantityGTtotalAvailableDummyPurchaseStock || false,
    }
}