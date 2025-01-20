import { AttributeValue } from '@aws-sdk/client-dynamodb'

export type MessageEventAttributes = {
    notificationType: string
    projectKey: string
    id: string
    version: number
    sequenceNumber: number
    resource: {
        typeId: string
        id: string
    }
    resourceVersion: number
    resourceUserProvidedIdentifiers: {
        orderNumber: string
    }
    type:
        | 'OrderStateChanged'
        | 'OrderStateTransition'
        | 'OrderPaymentStateChanged'
        | 'OrderShipmentStateChanged'
    createdAt: string
    lastModifiedAt: string
    createdBy: {
        clientId: string
        isPlatformClient: boolean
    }
    lastModifiedBy: {
        clientId: string
        isPlatformClient: boolean
    }
}

export type OrderStateChangedEvent = MessageEventAttributes & {
    orderState: string
    oldOrderState: string
}

export type OrderStateTransitionEvent = MessageEventAttributes & {
    state: {
        typeId: string
        id: string
    }
    oldState: {
        typeId: string
        id: string
    }
    force: boolean
}

export type OrderPaymentStateChangedEvent = MessageEventAttributes & {
    paymentState: string
    oldPaymentState: string
}

export type OrderShipmentStateChangedEvent = MessageEventAttributes & {
    shipmentState: string
    oldShipmentState: string
}

export type OrderHistoryItem = {
    id: AttributeValue
    event: AttributeValue
    orderId: AttributeValue
    orderNumber: AttributeValue
    sequenceNumber: AttributeValue
    fieldChanged: AttributeValue
    prevStatus: AttributeValue
    currentStatus: AttributeValue
    prevStateId: AttributeValue
    currentStateId: AttributeValue
    createdAt: AttributeValue
    lastModified: AttributeValue
}

export enum FieldChange {
    OrderStateChanged = 'order_status',
    OrderStateTransition = 'order_state_transition',
    OrderPaymentStateChanged = 'payment_status',
    OrderShipmentStateChanged = 'shipment_status',
}
