import { AttributeValue } from '@aws-sdk/client-dynamodb'

// TODO: change name if confirm name of event
export type OrderHistoryItem = {
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