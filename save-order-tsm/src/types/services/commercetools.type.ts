export type CouponInformationAttributes = {
    id: string
    no: string
    code: string
    amount: string
    serial: string
}

export type GetCouponInformationResult = {
    discounts: CouponInformationAttributes[]
    otherPayments: CouponInformationAttributes[]
}