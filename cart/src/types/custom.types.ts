import { Cart, LineItem } from "@commercetools/platform-sdk"

export type CustomCartWithNotice  = {
    ctCart: Cart,
    notice: string
}

export type CustomCartWithCompared = {
    ctCart: Cart,
    compared: any // TODO:
}

export type HasChangedAction = {
    action: 'UPDATE_QUANTITY'| 'REMOVE_LINE_ITEM' | 'NONE',
    updateValue: number
}

export type CustomLineItemHasChanged = LineItem & {
    hasChangedAction?: HasChangedAction
}