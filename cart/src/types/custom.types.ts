import { Cart } from "@commercetools/platform-sdk"

export type CustomCartWithNotice  = {
    ctCart: Cart,
    notice: string
}

export type CustomCartWithCompared = {
    ctCart: Cart,
    compared: any // TODO:
}