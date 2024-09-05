import { Request, Response } from 'express'
import { logger } from '../utils/logger.utils'
import { syncCartItemCatalog } from '../services/talon-one.service'
import { queryProducts } from '../services/commercetools.service'
import { buildData, buildRemoveData, buildRemoveManyData } from '../services/sync.service'

/**
 * Exposed event POST endpoint.
 * Receives the Pub/Sub message and works with it
 *
 * @param req The express request
 * @param res The express response
 */
export const syncController = async (req: Request, res: Response) => {
  logger.info(`Message: ${JSON.stringify(req.body)}`)
  
  if (!req.body?.message?.data) {
    logger.error('Missing request body')
    res.status(200).send('Bad request: No Pub/Sub message was received')
    return
  }

  try {
    const message = JSON.stringify(req.body.message.data)
    const data = JSON.parse(Buffer.from(message, 'base64').toString())
    logger.info(`Data: ${JSON.stringify(data)}`)
    let payload

    if (data.notificationType === 'Message' && data.type === 'ProductVariantDeleted') {
      payload = buildRemoveData([data.variant])

    } else {
      const productID = data.resource.id
      switch (data.notificationType) {
        case 'ResourceCreated':
        case 'ResourceUpdated':
          const products = await queryProducts(productID)
          if (products.length < 1) {
            res.status(200).send('No Products found')
            return
          }
          const product = products[0]?.masterData

          if (product.published && !product.hasStagedChanges) {
            logger.info(productID, 'Product has been Published')
            res.status(200).send()
            return
          }

          payload = buildData(productID, product?.staged)
          break

        case 'ResourceDeleted':
          payload = buildRemoveManyData(productID)
          break
      }
    }

    if (!payload) {
      res.status(200).send()
      return
    }

    const result = await syncCartItemCatalog(payload)
    logger.info(`Payload: ${JSON.stringify(payload)}`)
    logger.info(`Result: ${JSON.stringify(result)}`)
    res.status(200).send(result)

  } catch (error) {
    logger.error(`Bad request: ${error}`)
    res.status(500).send()
    return
  }
}
