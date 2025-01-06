import { ICart } from "../interfaces/cart";

export const updateCartFlag = (iCart: ICart): ICart => {

    const { items } = iCart;

    if (items.length <= 0) return { ...iCart, preOrder: false }

    return iCart
}

export const validateInventory = (inventory: any, quantity: number) => { 

    const { available, totalAvailableDummyStock, totalAvailableDummyPurchaseStock } = inventory.stock
    const quantityGTtotalAvailableDummyPurchaseStock = totalAvailableDummyPurchaseStock + quantity <= totalAvailableDummyStock

    return {
        isOutOfStock: inventory.isOutOfStock || false,
        isOverDummyStock: available <= 0 && totalAvailableDummyStock > 0 && !quantityGTtotalAvailableDummyPurchaseStock || false,
        isDummyStock: available <= 0 && totalAvailableDummyStock > 0 && quantityGTtotalAvailableDummyPurchaseStock || false,
    }
}