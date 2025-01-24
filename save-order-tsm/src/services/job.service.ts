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

export const saveOrderTSMService = async (): Promise<void> => {
    try {
        const orders = await getOrdersNotSaveOnTSM()
        if (orders.length === 0) {
            return
        }

        const orderSuccess: Order[] = []

        // chunk order step if order > 10
        const chunks = _.chunk(orders, 10)
        for (const chunkOrder of chunks) {
            const isSavedOnTSMSuccess = await saveOrderOnTSM(chunkOrder)
            if (!isSavedOnTSMSuccess) {
                await saveOrderOnDatabase(chunkOrder)
            }
            orderSuccess.push(...chunkOrder)

            // wait for 10 sec before process next chunk
            await new Promise((resolve) => setTimeout(resolve, 10000))
        }

        // Update order is saved on TSM to commercetools
        await updateOrderOnCommerceTools(orderSuccess)
    } catch (error) {
        logger.error(`saveOrderTSMService:badRequest:${JSON.stringify(error)}`)
        throw error
    }
}

export const getOrdersNotSaveOnTSM = async (): Promise<Order[]> => {
    const result = await commercetoolsServices.getBulkOrderNotSaveOnTSM()
    logger.info(`Found ${result.length} orders to process`)

    return result
}

// TODO: wait for flow retry process
// NOTE add logic retry save 5 time and include exponential backoff
export const saveOrderOnTSM = async (orders: Order[]): Promise<boolean> => {
    let attempt = 0
    let backoffTime = 0
    const apigeeAccessToken = await apigeeService.getToken()

    while (attempt <= 5) {
        try {
            logger.info(`saveOrderOnTSM:attempt:${attempt}`)

            // wait for backoff time
            if (backoffTime > 0) {
                logger.info(`saveOrderOnTSM:wait for backoff time:${backoffTime}`)
                await new Promise(resolve => setTimeout(resolve, backoffTime))
            }

            const result = await Promise.all(
                orders.map(async (order) => {
                    logger.info(`saveOrderOnTSM:order:${order.orderNumber}`)
                    const createTSMSaleOrderResult = await tsmService.createTSMSaleOrder(order, apigeeAccessToken)
                    return createTSMSaleOrderResult
                })
            )

            logger.info(result)
            break
        } catch (error) {
            logger.error(`saveOrderOnTSM:attempt:${attempt}:message:${JSON.stringify(error)}`)
            backoffTime = calculateExponentialBackoffTime(attempt)
            attempt++
        }
    }

    // NOTE - if not success 5 time return false
    if (attempt === 5) {
        return false
    } else {
        return true
    }
}


// TODO: wait for data models
// process after try to save on TSM but not success 5 time
export const saveOrderOnDatabase = async (orders: Order[]): Promise<void> => {
    // convert order to data models and save on database
    logger.info(`saveOrderOnDatabase:start:${JSON.stringify(orders)}`)
    const item = {}

    const tableName = `tsm-failed-create-order-${readConfiguration().appEnv}`
    await dynamodbService.putItem({
        tableName,
        item: marshall(item)
    })
}

// TODO: wait for make sure about data has saved on TSM
export const updateOrderOnCommerceTools = async (orders: Order[]): Promise<void> => {
    // update order on commercetools
    logger.info(`updateOrderOnCommerceTools:start:${JSON.stringify(orders)}`)
    // await commercetoolsServices.bulkUpdateOrderIsSavedOnTSM(orders.map(order => order.id))
}