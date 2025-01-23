import { createApiRoot } from '../client/create.client.js'
import { logger } from '../utils/logger.utils.js'

const apiRoot = createApiRoot()

export const getOrders = async (queryArgs: any) => {
    try {
        const { body } = await apiRoot
            .orders()
            .get({ queryArgs })
            .execute()

        return body
    } catch (error) {
        logger.error(`Get orders ${error}`)
        return null
    }
}

export const updateOrder = async (orderID: string, actions: any) => {
    try {
        const { body } = await apiRoot
            .orders()
            .withId({ ID: orderID })
            .post({ body: actions })
            .execute()

        return body
    } catch (error: any) {
        logger.error(`Update order ID ${orderID} ${error}`)
        return null
    }
}