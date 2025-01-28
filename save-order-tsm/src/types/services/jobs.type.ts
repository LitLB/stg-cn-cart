import { Order } from "@commercetools/platform-sdk"
import { CreateTSMSaleOrderResponse } from "./tsm.type"

export type SaveOrderOnTSMResult= { 
    success: boolean,
    order: Order 
    tsmResponse?: CreateTSMSaleOrderResponse
}

export type SaveBulkOrderOnTSMResult = {
    success: SaveOrderOnTSMResult[],
    failed: SaveOrderOnTSMResult[]
}

export type CustomOrderWithTSMResponse = {
    order: Order
    tsmResponse?: CreateTSMSaleOrderResponse
}
