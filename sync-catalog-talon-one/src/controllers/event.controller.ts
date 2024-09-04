import { Request, Response } from 'express'
import CustomError from '../errors/custom.error'
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
  if (!req.body?.message?.data) {
    logger.error('Missing request body.')
    res.status(400).send('Bad request: No Pub/Sub message was received')
  }

  try {
    const message = JSON.stringify(req.body.message.data)
    const data = JSON.parse(Buffer.from(message, 'base64').toString())
    let payload

    if (data.notificationType === 'Message' && data.type === 'ProductVariantDeleted') {
      payload = buildRemoveData([data.variant])

    } else {
      const productID = data.resource.id
      switch(data.notificationType) {
        case 'ResourceCreated' || 'ResourceUpdated':
          const products = await queryProducts(productID)
          if (products.length > 0) {
            const product = products[0]?.masterData

            if (product.published && !product.hasStagedChanges) {
              logger.info(productID, 'Product has been Published')
              res.status(204).send()
            }

            payload = buildData(productID, product?.staged)
          }
          break
          
        case 'ResourceDeleted':
          payload = buildRemoveManyData(productID)
          break
      }
    }

    if (!payload)
      res.status(404).send(payload)

    const result = await syncCartItemCatalog(payload)
    res.status(200).send(result)

  } catch (error) {
    throw new CustomError(400, `Bad request: ${error}`)
  }
}
