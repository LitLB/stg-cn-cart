import { Request, Response } from 'express'
import { logger } from '../utils/logger.utils'
import { queryProducts, queryCustomerGroupList, updateProduct } from '../services/commercetools.service'

/**
 * Exposed event POST endpoint.
 * Receives the Pub/Sub message and works with it
 *
 * @param req The express request
 * @param res The express response
 */
interface Products {
    [id: string]: {
        [sku: string]: any
    }
}

interface ProductsDraft {
    [id: string]: any
}

let products: Products = {}
let productsDraft: ProductsDraft = {}

export const productController = async (req: Request, res: Response) => {
    try {
        const body = req.body
        logger.info(`Strike through: ${body}`)
        const campaignID = body.trigger.payload.campaignId
        const items = req.body.changedItems.flatMap((item: any) => item.effects)
        const effects = (body.trigger.type === 'CAMPAIGN_UPDATE') 
            ? items.filter((effect: any) => effect.campaignId === campaignID)
            : items

        const query = await queryCustomerGroupList()

        let customerGroup: { [key: string]: any } = {}
        query.forEach((q: any) => {
            customerGroup[q.key] = q.id
        })

        const rrpID = customerGroup['RRP']
        if (!rrpID) {
            res.status(200).send(`No RRP in customer group list`)
            logger.error(`No RRP in customer group list`)
            return
        }

        for (const e of effects) {
            const effect = e.props.payload
            if (effect.company === '' || effect.journey === '') continue

            const customerGroupKey = getCustomerGroupKey(effect)
            const customerGroupID = customerGroup[customerGroupKey]

            if (!customerGroupID) {
                logger.error(`Not found Customer group key: ${customerGroupKey}`)
                continue
            }

            const productID = effect.commercetools_product_id
            const product = (productID in products) ? products[productID] : await buildProduct(productID, rrpID)
            const sku = product[effect.sku]
            if (!sku) {
                logger.error(`Not found Product: ${productID} - sku: ${effect.sku}`)
                continue
            }

            if (sku.otherPrices.length > 0) {
                for (const price of sku.otherPrices) {
                    const action = await wrapRemovePayload(customerGroupID, price)
                    if (action) productsDraft[productID].actions.push(action)
                }
            }

            for (const price of sku.rrpPrices) {
                const action = await wrapPayload(customerGroupID, sku.id, price, Number(effect.total_discount_amount))
                productsDraft[productID].actions.push(action)
            }
        }

        for (const productID in productsDraft) {
            const draft = productsDraft[productID]
            logger.info(`Payload Product ${productID}: ${JSON.stringify(draft)}`)

            if (draft?.actions.length === 0) continue

            const result = await updateProduct(productID, draft)
            logger.info(`Update Product ${productID}: ${JSON.stringify(result)}`)
        }

        products = {}
        productsDraft = {}
        res.status(200).send()

    } catch (error) {
        logger.error(`Bad request: ${error}`)
        res.status(500).send()
        return
    }
}

const wrapRemovePayload = async (customerGroupID: string, price: any) => {
    if (price?.customerGroup?.id !== customerGroupID) return
    return {
        action: 'removePrice',
        priceId: price.id
    }
}

const wrapPayload = async (customerGroupID: string, variantID: number, price: any, discount: number) => {
    const amount = price.value.centAmount - (discount * (10 ** price.value.fractionDigits))
    const validFrom = { validFrom: price.validFrom || null }
    const validUntil = { validUntil: price.validUntil || null }
    return {
        action: 'addPrice',
        variantId: variantID,
        price: {
            value: {
                currencyCode: 'THB',
                centAmount: Math.max(amount, 0)
            },
            customerGroup: {
                typeId: 'customer-group',
                id: customerGroupID
            },
            ...validFrom,
            ...validUntil
        }
    }
}

const buildProduct = async (id: string, rrpID: string) => {
    const query = await queryProducts(id)
    const data = query[0].masterData.staged
    const variants = [data.masterVariant].concat(data.variants)

    variants.forEach((variant: any) => {
        const rrpPrices: Array<any> = []
        const otherPrices: Array<any> = []

        variant.prices.forEach((price: any) => {
            if (price.customerGroup.id === rrpID) rrpPrices.push(price)
            else otherPrices.push(price)
        })

        if (!products[id]) products[id] = {}

        products[id][variant.sku] = {
            id: variant.id,
            rrpPrices,
            otherPrices
        }
    })

    productsDraft[id] = {
        version: query[0].version,
        actions: []
    }

    return products[id]
}

const getCustomerGroupKey = (effect: any): string => {
    return [effect.journey, effect.loyalty_tier].join('_')
        .toLowerCase()
        .replace(/[_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
}
