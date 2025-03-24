export type OrderPayload = {
    order: {
        orderId: string,
        customer: {
            id: string,
            name: string,
            address: string,
        },
        shop: {
            code: string,
        },
        sale: {
            code: string,
            name: string,
        },
        totalAmount: string,
        discountAmount: string,
        totalAfterDiscount: string,
        otherPaymentAmount: string,
        grandTotal: string,
        discounts: number,
        otherPayments: number,
        items: Record<string, any>,
    }
}