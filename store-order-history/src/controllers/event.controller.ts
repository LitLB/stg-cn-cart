import { Request, Response } from 'express'
import { logger } from '../utils/logger.utils'
// import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

/**
 * Exposed event POST endpoint.
 * Receives the Pub/Sub message and works with it
 *
 * @param req The express request
 * @param res The express response
 */
export const storeOrderHistoryController = async (req: Request, res: Response) => {
    try {
        if (!req.body?.message?.data) {
            logger.error('Missing request body')
            res.status(200).send()
            return
        }

        const message = JSON.stringify(req.body.message.data)
        const data = JSON.parse(Buffer.from(message, 'base64').toString())

        let payload
        const productID = data.resource.id

        // const dynamoDBClient =  this.DynamoDBClient
        
        if (data.notificationType === 'Message') {
            // console.log(test)
        }

        if (!payload) {
            logger.info(`No Payload: ${productID}`)
            res.status(200).send()
            return
        }

        logger.info(`Payload ${productID}: ${JSON.stringify(payload)}`)
        res.status(200).send({})
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        res.status(200).send()
        return
    }
}
