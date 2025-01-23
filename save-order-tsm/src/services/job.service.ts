import { Order } from '@commercetools/platform-sdk'
import { logger } from '../utils/logger.utils'
import { calculateExponentialBackoffTime } from '../utils/time.utils'
import * as commercetoolsServices from './commercetools.service'
import * as apigeeService from './apigee.service'

export const saveOrderTSMService = async (): Promise<void> => {
    const orders = await getOrdersNotSaveOnTSM()
    if (orders.length === 0) {
        return
    }

    // chunk order step if order > 10
    const isSavedOnTSMSuccess = await saveOrderOnTSM(orders[0])
    if (!isSavedOnTSMSuccess) {
        await saveOrderOnDatabase(orders[0])
    }

    return
}

export const getOrdersNotSaveOnTSM = async (): Promise<Order[]> => {
    const result = await commercetoolsServices.getBulkOrderNotSaveOnTSM()
    logger.info(`Found ${result.length} orders to process`)

    return result
}

// TODO: wait for flow retry process
// NOTE add logic retry save 5 time and include exponential backoff
export const saveOrderOnTSM = async (order: Order): Promise<boolean> => {
    let attempt = 1
    let backoffTime = 0
    const apigeeAccessToken = await apigeeService.getToken()

    while (attempt <= 5) {
        logger.error(`saveOrderOnTSM:attempt:${attempt}`)
        try {
            // wait for backoff time
            if (backoffTime > 0) {
                logger.info(`saveOrderOnTSM:wait for backoff time:${backoffTime}`)
                await new Promise(resolve => setTimeout(resolve, backoffTime))
            }

            //TODO: save on TSM
            //NOTE - Question ????? ---> how many error case on TSM  
            await apigeeService.saveOrderTSM({ accessToken: apigeeAccessToken, data: order })
            break
        } catch (error) {
            logger.error(`saveOrderOnTSM:attempt:${attempt}:message:${JSON.stringify(error)}`)
            backoffTime = calculateExponentialBackoffTime(attempt)
            attempt++
        }
    }

    if (attempt === 5) {
        return false
    } else {
        return true
    }
}

// process after try to save on TSM but not success 5 time
export const saveOrderOnDatabase = async (order: Order): Promise<void> => {
    logger.info(`order save done:${order.id}`)
}