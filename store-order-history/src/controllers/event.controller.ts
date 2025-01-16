import { Request, Response } from 'express'
import { logger } from '../utils/logger.utils'
import * as eventService from '../services/event.service'

const ORDER_EVENT_LIST = ['OrderStateChanged', 'OrderStateTransition', 'OrderPaymentStateChanged', 'OrderShipmentStateChanged']

export const storeOrderHistoryController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.body?.message?.data) {
            logger.error('Missing request body')
            throw new Error('Missing request body')
        }

        const data = eventService.parsePayload(req.body.message.data)

        if (data.notificationType === 'Message') {
            if (data.resource.typeId === 'order') {
                if (ORDER_EVENT_LIST.includes(data.type)) {
                    const order = await eventService.getOrderById(data.resource.id)

                    const orderHistoryItem = eventService.mapOrderHistoryItem(data, order)

                    const result = await eventService.saveOrderHistory(orderHistoryItem)

                    res.status(200).json({ statusCode: 200, statusMessage: 'success', data: result })
                    return
                }
            }
        }

        res.status(200).send({ status: 'success' })
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        res.status(200).send({ statusCode: 500, statusMessage: 'failed', message: error })
        return
    }
}
