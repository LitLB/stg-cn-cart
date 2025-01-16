import { Order } from '@commercetools/platform-sdk'
import * as commerceToolsService from './commercetools.service'
import * as dynamodbClient from './dynamodb.service'
import { OrderHistoryItem } from '../types/controllers/event.type'
import { PutItemCommandOutput } from '@aws-sdk/client-dynamodb'
import { readConfiguration } from '../utils/config.utils'

const STORE_ORDER_HISTORY_TABLE = `true-ecommerce-order-history-${readConfiguration().appEnv}`

// TODO: back to define type for result
export const parsePayload = (payload: string): any => {
    const payloadStr = JSON.stringify(payload)
    const result = JSON.parse(Buffer.from(payloadStr, 'base64').toString())

    return result
}

export const getOrderById = async (id: string): Promise<Order> => {
    const expandFields = ['state']
    const order = await commerceToolsService.queryOrderById(id, expandFields)
    if (!order) {
        throw new Error('Order not found')
    }

    return order
}

// TODO: back to define input data type
export const mapOrderHistoryItem = (data: any, order: Order): OrderHistoryItem => {
    const orderState = order.state?.obj?.key || 'UNKNOWN'
    const orderStatus = order.orderState
    const paymentStatus = order.paymentState || 'Pending'
    const shipmentStatus = order.shipmentState || 'Pending'

    const storeItem: OrderHistoryItem = {
        id: { S: data.id },
        orderId: { S: order.id },
        event: { S: data.type },
        orderState: { S: orderState },
        orderStatus: { S: orderStatus },
        paymentStatus: { S: paymentStatus },
        shipmentStatus: { S: shipmentStatus },
        createdAt: { S: order.createdAt },
        lastModified: { S: order.lastModifiedAt },
        data: { S: JSON.stringify(order) },
    }

    return storeItem
}

export const saveOrderHistory = async (orderData: OrderHistoryItem): Promise<PutItemCommandOutput | null> => {
    const storedOrder = await dynamodbClient.putItem({
        tableName: STORE_ORDER_HISTORY_TABLE,
        item: orderData,
    })

    return storedOrder
}
