import { Request, Response } from 'express'
import { logger } from '../utils/logger.utils'
import { queryProducts, queryCustomerGroupList, updateProduct } from '../services/commercetools.service'
import { callPDPWorkflow } from '../services/etl.service'

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

interface campaignGroups {
    [id: string]: {
        keys: any
    }
}

let products: Products = {}
let productsDraft: ProductsDraft = {}
let campaignGroups: campaignGroups = {}

export const productController = async (req: Request, res: Response) => {
    try {
        const body = req.body
        logger.info(`Strike through: ${JSON.stringify(body)}`)

        const triggerType = body.trigger?.type
        if (!body || (triggerType !== 'CAMPAIGN_UPDATE' && triggerType !== 'CATALOG_SYNC')) {
            res.status(200).send()
            return
        }

        if (!body.changedItems.length || body.changedItems.length < 1) {
            res.status(200).send()
            return
        }
        
        const campaignID = body.trigger.payload.campaignId
        const items = body.changedItems.flatMap((item: any) => item.effects)
        const effects = (triggerType === 'CAMPAIGN_UPDATE') 
            ? items.filter((effect: any) => effect.campaignId === campaignID)
            : items

        const query = await queryCustomerGroupList()

        let customerGroup: { [key: string]: any } = {}
        query.forEach((q: any) => {
            customerGroup[q.key.toLowerCase()] = q.id
        })

        const rrpID = customerGroup['rrp']
        if (!rrpID) {
            logger.error(`No RRP in customer group list`)
            res.status(200).send()
            return
        }

        for (const e of effects) {
            const effect = e.props.payload
            if (!effect.company || !effect.campaign_group
                || effect.company === 'null' || effect.campaign_group === 'null') continue

            const productID = effect.commercetools_product_id
            if (!productID || productID === 'null') continue

            if (triggerType === 'CAMPAIGN_UPDATE') {
                if (!campaignGroups[productID]) campaignGroups[productID] = { keys: [] }
                campaignGroups[productID].keys.push(effect.campaign_group)
            }

            if (!effect.journey || effect.journey === 'null') continue

            const customerGroupKey = getCustomerGroupKey(effect)
            const customerGroupID = customerGroup[customerGroupKey.toLocaleLowerCase()]

            if (!customerGroupID) {
                logger.error(`No Customer group key: ${customerGroupKey}`)
                continue
            }

            const product = (productID in products) ? products[productID] : await buildProduct(productID, rrpID)

            if (!product) {
                logger.error(`No Product: ${productID}`)
                continue
            }

            const sku = product[effect.sku]
            if (!sku) {
                logger.error(`No Product: ${productID} - ${effect.sku}`)
                continue
            }

            if (sku.otherPrices.length > 0) {
                for (const price of sku.otherPrices) {
                    const action = await wrapRemovePayload(customerGroupID, price)
                    if (action) productsDraft[productID].actions.push(action)
                }
            }

            if (sku.rrpPrices.length > 0) {
                for (const price of sku.rrpPrices) {
                    const action = await wrapPayload(customerGroupID, sku.id, price, effect)
                    productsDraft[productID].actions.push(action)
                }
            } else
                logger.info(`No RRP prices Product: ${productID} - ${effect.sku}`)
        }

        for (const productID in productsDraft) {
            const draft = productsDraft[productID]
            logger.info(`Payload Product ${productID}: ${JSON.stringify(draft)}`)

            if (draft?.actions.length === 0) continue

            const result = await updateProduct(productID, draft)
            logger.info(`Update Product ${productID}: ${JSON.stringify(result)}`)
        }

        for (const productID in campaignGroups) {
            logger.debug(`Campaign group for product ${productID}: ${campaignGroups[productID]}`)
            await callPDPWorkflow({
                commercetools_product_id: productID,
                campaign_groups: [...new Set(campaignGroups[productID].keys)]
            })
        }

        products = {}
        productsDraft = {}
        campaignGroups = {}
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

const wrapPayload = async (customerGroupID: string, variantID: number, price: any, effect: any) => {
    const amount = price.value.centAmount - (effect.total_discount_amount * (10 ** price.value.fractionDigits))
    const validFrom = price.validFrom
    const validUntil = price.validUntil
    const hasFreeGift = effect?.has_free_gift || null
    const custom = hasFreeGift ? {
        type: {
            typeId: "type",
            key: "productAudiencePriceAdditionalField"
        },
        fields: { hasFreeGift: hasFreeGift === "true" }
    } : null

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
            ...{ validFrom },
            ...{ validUntil },
            ...{ custom }
        }
    }
}

const buildProduct = async (id: string, rrpID: string) => {
    const query = await queryProducts(id)
    if (query.length < 1) return

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
    return [effect.company, effect.campaign_group, effect.journey, effect.loyalty_tier]
        .join('__')
        .replace(/__+$/, '')
}
