import { State } from "@commercetools/platform-sdk"
import { LOCALES } from "../../constants/locale.constant"

export type GetAllOrderStatesResult = {
    [stateId: string]: State
}

export type OrderHistoryResult = {
    id: string
    orderId: string
    orderNumber: string
    stateType: string
    previous: {
        status: string
        state: {
            id: string
            key: string
            [LOCALES.TH_TH]: string
            [LOCALES.EN_US]: string
        } | null
    }
    current: {
        status: string
        state: {
            id: string
            key: string
            [LOCALES.TH_TH]: string
            [LOCALES.EN_US]: string
        } | null
    }
    lastModified: string
}
export type OrderHistoryItem = {
    id: string
    event: string
    orderId: string
    orderNumber: string
    sequenceNumber: number
    fieldChanged: string
    prevStatus: string
    currentStatus: string
    prevStateId: string
    currentStateId: string
    createdAt: string
    lastModified: string
}