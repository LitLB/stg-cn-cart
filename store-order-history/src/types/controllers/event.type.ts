import { AttributeValue } from '@aws-sdk/client-dynamodb'

export type POCTableItem = {
    value: AttributeValue
    active: AttributeValue
    lastModified: AttributeValue
    journey: AttributeValue
    id: AttributeValue
    modifiedBy: AttributeValue
    type: AttributeValue
}

// TODO: change name if confirm name of event
export type StoreOrderHistoryItem = {
    id: AttributeValue
    orderId: AttributeValue
    event: AttributeValue
    orderStatus: AttributeValue
    orderState: AttributeValue
    paymentStatus: AttributeValue
    shipmentStatus: AttributeValue
    createdAt: AttributeValue
    lastModified: AttributeValue
    data: AttributeValue
}