import { Order, State } from '@commercetools/platform-sdk'
import * as commerceToolsService from './commercetools.service'
import * as dynamodbClient from './dynamodb.service'
import {
    FieldChange,
    MessageEventAttributes,
    OrderHistoryItem,
    OrderPaymentStateChangedEvent,
    OrderShipmentStateChangedEvent,
    OrderStateChangedEvent,
    OrderStateTransitionEvent,
} from '../types/controllers/event.type'
import { PutItemCommandOutput } from '@aws-sdk/client-dynamodb'
import { readConfiguration } from '../utils/config.utils'
import { logger } from '../utils/logger.utils'

const STORE_ORDER_HISTORY_TABLE = `true-ecommerce-order-history-${readConfiguration().appEnv}`

export const parsePayload = (payload: string): MessageEventAttributes => {
    const payloadStr = JSON.stringify(payload)
    const result = JSON.parse(Buffer.from(payloadStr, 'base64').toString())

    return result as MessageEventAttributes
}

export const getOrderById = async (id: string): Promise<Order> => {
    const expandFields = ['state']
    const order = await commerceToolsService.queryOrderById(id, expandFields)
    if (!order) {
        throw new Error('Order not found')
    }

    return order
}

export const getOrderStateById = async (id: string): Promise<State> => {
    const state = await commerceToolsService.queryStateById(id)
    if (!state) {
        logger.error(`state not found: ${id}`)
        throw new Error('State not found')
    }

    return state
}

export const mapOrderHistoryItem = async (
    data: MessageEventAttributes
): Promise<OrderHistoryItem> => {
    const fieldChanged = FieldChange[data.type]
    let prevStatus: string
    let currentStatus: string
    let prevStateId = 'none'
    let currentStateId = 'none'

    if (data.type === 'OrderStateTransition') {
        const _data = data as OrderStateTransitionEvent
        const [prevState, currentState] = await Promise.all([
            commerceToolsService.queryStateById(_data.oldState.id),
            commerceToolsService.queryStateById(_data.state.id),
        ])

        prevStatus = prevState?.key ?? 'none'
        currentStatus = currentState?.key ?? 'none'
        prevStateId = _data.state.id
        currentStateId = _data.oldState.id
    } else if (data.type === 'OrderStateChanged') {
        const _data = data as OrderStateChangedEvent
        prevStatus = _data.oldOrderState
        currentStatus = _data.orderState
    } else if (data.type === 'OrderPaymentStateChanged') {
        const _data = data as OrderPaymentStateChangedEvent
        prevStatus = _data.oldPaymentState
        currentStatus = _data.paymentState
    } else if (data.type === 'OrderShipmentStateChanged') {
        const _data = data as OrderShipmentStateChangedEvent
        prevStatus = _data.oldShipmentState
        currentStatus = _data.shipmentState
    } else {
        const errorMessage = `Unknown event type: ${data.type}`
        logger.error(errorMessage)
        throw new Error(errorMessage)
    }

    const storeItem: OrderHistoryItem = {
        id: { S: data.id },
        event: { S: data.type },
        orderId: { S: data.resource.id },
        orderNumber: { S: data.resourceUserProvidedIdentifiers.orderNumber },
        sequenceNumber: { N: `${data.sequenceNumber}` },
        fieldChanged: { S: fieldChanged },
        prevStatus: { S: prevStatus },
        currentStatus: { S: currentStatus },
        prevStateId: { S: prevStateId },
        currentStateId: { S: currentStateId },
        createdAt: { S: data.createdAt },
        lastModified: { S: data.lastModifiedAt },
    }

    return storeItem
}

export const saveOrderHistory = async (
    orderData: OrderHistoryItem
): Promise<PutItemCommandOutput | null> => {
    const storedOrder = await dynamodbClient.putItem({
        tableName: STORE_ORDER_HISTORY_TABLE,
        item: orderData,
    })

    return storedOrder
}
