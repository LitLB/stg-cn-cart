import { Request, Response } from 'express'
import { logger } from '../utils/logger.utils'
import { syncCartItemCatalog } from '../services/talon-one.service'
import * as syncService from '../services/sync.service'

/**
 * Exposed event POST endpoint.
 * Receives the Pub/Sub message and works with it
 *
 * @param req The express request
 * @param res The express response
 */
export const syncController = async (req: Request, res: Response) => {
  if (!req.body?.message?.data) {
    logger.error('Missing request body')
    res.status(200).send()
    return
  }

  try {
    const message = JSON.stringify(req.body.message.data)
    const data = JSON.parse(Buffer.from(message, 'base64').toString())

    let payload
    const productID = data.resource.id
    const product = await syncService.getProduct(productID)
    logger.info(`${data.type} ID ${productID}: ${message}`)

    if (data.notificationType === 'Message') {
      switch (data.type) {
        case 'ProductCreated':
          payload = syncService.buildData(productID, data.productProjection)
          break

        case 'ProductVariantAdded':
          if (product)
            payload = syncService.buildData(productID, product?.staged, data.variant.id)
          break

        case 'ProductPriceAdded':
        case 'ProductPriceChanged':
        case 'ProductPriceRemoved':
          const price = data.price ? data.price : data.newPrice
          const isRRP = await syncService.isRRP(price.customerGroup?.id)
          if (product && isRRP)
            payload = syncService.buildData(productID, product?.staged, data.variantId)
          break

        case 'ProductVariantDeleted':
          payload = syncService.buildRemoveData([data.variant])
          break

        case 'ProductDeleted':
          payload = syncService.buildRemoveManyData(productID)
          break
      }
    }

    if (!payload) {
      logger.info(`No Payload: ${productID}`)
      res.status(200).send()
      return
    }

    const result = await syncCartItemCatalog(payload)
    logger.info(`Payload ${productID}: ${JSON.stringify(payload)}`)
    logger.info(`Result ${productID}: ${JSON.stringify(result)}`)
    res.status(200).send(result)

  } catch (error) {
    logger.error(`Bad request: ${error}`)
    res.status(500).send()
    return
  }
}
