// cart/src/interfaces/order.ts

export interface IOrderAdditional {
    orderInfo: IOrderInfo
    paymentInfo: IPaymentInfo[]
    customerInfo: ICustomerInfo
}

export interface IOrderInfo {
    journey: string
}

export interface IPaymentInfo {
    tmhAccountNumber: string
    bankAccount: string
    bankAccountName: string
    creditCardNumber: string
    created: string
    paymentState: string
    chargeId?: string
}

export interface ICustomerInfo {
    ipAddress: string
    googleID: string
}
  
export interface IClientInfo {
    ip: string
    googleId: string
}