import { Request, Response } from 'express'
import { logger } from '../utils/logger.utils'
import * as eventService from '../services/event.service'

export const storeOrderHistoryController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.body?.message?.data) {
            logger.error('Missing request body')
            throw new Error('Missing request body')
        }
        
        const data = eventService.parsePayload(req.body.message.data)
        logger.info(`storeOrderHistory:start:${data.id}`)
        logger.info(`storeOrderHistory:payload: ${JSON.stringify(data)}`)

        if (data.notificationType === 'Message') {
            if (data.resource.typeId === 'order') {
                const orderHistoryItem = await eventService.mapOrderHistoryItem(data)

                await eventService.saveOrderHistory(orderHistoryItem)
            }
        }

        logger.info(`storeOrderHistory:done:${data.id}`)
        res.status(200).send({ status: 'success' })
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        res.status(200).send({ statusCode: 500, statusMessage: 'failed', message: error })
        return
    }
}
