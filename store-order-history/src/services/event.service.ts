import { Order } from '@commercetools/platform-sdk'
import * as commerceToolsService from './commercetools.service'
import * as dynamodbClient from './dynamodb.service'
import { StoreOrderHistoryItem } from '../types/controllers/event.type'
import { PutItemCommandOutput } from '@aws-sdk/client-dynamodb'

// const STORE_ORDER_HISTORY_TABLE = 'store-order-history'
const STORE_ORDER_HISTORY_TABLE = 'poc-table'

// TODO: back to define type for result
export const parsePayload = (payload: string): any => {
    const payloadStr = JSON.stringify(payload)
    const result = JSON.parse(Buffer.from(payloadStr, 'base64').toString())

    return result
}

export const getOrderById = async (id: string): Promise<Order> => {
    const order = await commerceToolsService.queryOrderById(id)
    if (!order) {
        throw new Error('Order not found')
    }

    return order
}

// TODO: back to define input data type
export const mapStoreOrderHistoryData = (data: any, order: Order): StoreOrderHistoryItem => {

    // TODO: find out how to mapping orderState with commercetools
    const storeItem: StoreOrderHistoryItem = {
        id: { S: data.id },
        orderId: {S: order.id},
        event: { S: data.type },
        orderState: { S: order.orderState },
        orderStatus: { S: order.orderState  },
        paymentStatus: { S: order.paymentState || 'Pending' },
        shipmentStatus: { S: order.shipmentState || 'Pending' },
        createdAt: { S: order.createdAt },
        lastModified: { S: order.lastModifiedAt },
        data: { S: JSON.stringify(order) },
    }

    return storeItem
}

export const saveStoreOrderHistory = async (orderData: StoreOrderHistoryItem): Promise<PutItemCommandOutput | null> => {
    const storedOrder = await dynamodbClient.putItem({
        tableName: STORE_ORDER_HISTORY_TABLE,
        item: orderData,
    })

    return storedOrder
}