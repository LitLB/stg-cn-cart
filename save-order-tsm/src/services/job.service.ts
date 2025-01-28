import { Order } from '@commercetools/platform-sdk'
import { logger } from '../utils/logger.utils'
import { calculateExponentialBackoffTime } from '../utils/time.utils'
import * as commercetoolsServices from './commercetools.service'
import * as dynamodbService from './dynamodb.service'
import * as tsmService from './tsm.service'
import * as apigeeService from './apigee.service'
import { readConfiguration } from '../utils/config.utils'
import { marshall } from '@aws-sdk/util-dynamodb'
import _ from 'lodash'
import { CustomOrderWithTSMResponse, SaveBulkOrderOnTSMResult, SaveOrderOnTSMResult } from '../types/services/jobs.type'
import { COUPON_INFO_CONTAINER } from "../constants/ct.constant"

export const saveOrderTSMService = async (): Promise<void> => {
    try {
        const orders = await commercetoolsServices.getBulkOrderNotSaveOnTSM()
        logger.info(`Found ${orders.length} orders to process`)
        logger.info(`orders:[${orders.map(order => order.orderNumber).join(',')}]`)
        if (orders.length === 0) return

        const saveOrderSuccess: CustomOrderWithTSMResponse[] = []
        const saveOrderFailed: CustomOrderWithTSMResponse[] = []

        // chunk order step if order > 10
        const chunks = _.chunk(orders, 100)
        for (const chunkOrder of chunks) {
            const { success, failed } = await saveBulkOrderOnTSM(chunkOrder)
            if (failed.length > 0) {

                saveOrderFailed.push(...failed.map(item => {
                    return {
                        order: item.order,
                        tsmResponse: item.tsmResponse
                    }
                }))
            }

            if (success.length > 0) {
                saveOrderSuccess.push(...success.map(item => {
                    return {
                        order: item.order,
                        tsmResponse: item.tsmResponse
                    }
                }))
            }

            // wait for 10 sec before process next chunk
            await new Promise((resolve) => setTimeout(resolve, 1 * 1000))
        }

        // Update order is saved on TSM to commercetools
        await Promise.all([
            bulkUpdateOrderIsSavedOnTSM(saveOrderSuccess),
            saveOrderOnDatabase(saveOrderFailed)
        ])
    } catch (error) {
        logger.error(`saveOrderTSMService:badRequest:${JSON.stringify(error)}`)
        throw error
    }
}

export const saveOrderOnTSM = async (order: Order, apigeeAccessToken: string, attemptTime = 5): Promise<SaveOrderOnTSMResult> => {
    let attempt = 0
    let backoffTime = 0
    let result: SaveOrderOnTSMResult['tsmResponse'] | undefined

    // prepare information before save
    const couponDiscounts = await commercetoolsServices.getCouponInformation(order.orderNumber!, COUPON_INFO_CONTAINER, order.cart!.id)

    while (attempt <= attemptTime) {
        try {
            // wait for backoff time
            if (backoffTime > 0) {
                logger.info(`saveOrderOnTSM:backoff:attempt:${attempt}:${backoffTime}ms`)
                await new Promise(resolve => setTimeout(resolve, backoffTime))
            }

            const _result = await tsmService.createTSMSaleOrder(order, couponDiscounts, apigeeAccessToken)
            result = _result
            if (!_result.success) {
                const errorMessage = _result.response?.message || `orderId code != 0:${order.id}`
                throw new Error(errorMessage)
            }

            break
        } catch (error: any) {
            logger.error(`saveOrderOnTSM:attempt:${attempt}:message:"${error?.message || `unknown error`}"`)
            backoffTime = calculateExponentialBackoffTime(attempt)
            attempt++
        }
    }

    // NOTE - if not success 5 time return false
    if (attempt >= 5) {
        return {
            success: false,
            order: order,
            tsmResponse: result
        }
    } else {
        return {
            success: true,
            order: order,
            tsmResponse: result
        }
    }

}

export const saveBulkOrderOnTSM = async (orders: Order[]): Promise<SaveBulkOrderOnTSMResult> => {
    const apigeeAccessToken = await apigeeService.getToken()
    const result = await Promise.all(orders.map(order => saveOrderOnTSM(order, apigeeAccessToken)))

    const success: SaveOrderOnTSMResult[] = []
    const failed: SaveOrderOnTSMResult[] = []

    result.forEach(item => {
        if (item.success) {
            success.push(item)
        } else {
            failed.push(item)
        }
    })

    return {
        success,
        failed
    }
}


export const saveOrderOnDatabase = async (orders: CustomOrderWithTSMResponse[]): Promise<void> => {
    if (orders.length === 0) return

    // update order on commercetools
    await Promise.all(orders.map(item => commercetoolsServices.updateOrderIsSavedOnTSM(item.order, false, item.tsmResponse)))

    //TODO: wait for data model
    // convert order to data models and save on database
    const item = {}

    const tableName = `tsm-failed-create-order-${readConfiguration().appEnv}`
    await dynamodbService.putItem({
        tableName,
        item: marshall(item)
    })
}

export const bulkUpdateOrderIsSavedOnTSM = async (orders: CustomOrderWithTSMResponse[]): Promise<void> => {
    if (orders.length === 0) return

    // update order on commercetools
    await Promise.all(orders.map(item => commercetoolsServices.updateOrderIsSavedOnTSM(item.order, true, item.tsmResponse)))
}