import { OrderPayload } from "../models/tsm-order.type"

export type SaveOrderTSMParams = {
    data: OrderPayload
    accessToken?: string
}