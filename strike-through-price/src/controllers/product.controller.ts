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
let productsDraft: ProductsDraft = []
export const productController = async (req: Request, res: Response) => {
    // logger.info(`Message: ${JSON.stringify(req.body)}`)
    // buildProduct('08be4c21-d429-4b27-82d4-d0ca4835441d')
    // res.status(200).send()
    // return
    // try {
    const body = req.body
    // body.trigger.type = 'CAMPAIGN_UPDATE'
    const campaignID = body.trigger.payload.campaignId
    // const items = req.body.changedItems.filter((item: any) => {
    //     return item.effects.length > 0
    // })
    // console.log(changedItems)
    const effects = req.body.changedItems.flatMap((item: any) => item.effects)
        .filter((effect: any) => effect.campaignId === campaignID)

    // await effects.forEach(async (effect: any) => {
    //     console.log(variants.length)
    //     const effect = effect.props.effect
    //     const productID = effect.commercetools_product_id
    //     const products  = await queryProducts(productID)
    //     await variants.push({ id: productID, data: products[0] })
    // })
    // for (const item of items) {
    //     for (const effect of item.effects) {
    //         const effect = effect.props.effect
    //         if (effect.campaignId !== campaignID || effect.company === '' || effect.journey === '')
    //             continue
    //         console.log(effect)

    //     }
    //     // console.log(item.effects)

    //     // continue
    // }

    // await effects.forEach(async (effect: any) => {
    const customerGroupList = await queryCustomerGroupList()
    const rrp = customerGroupList.find((cg: any) => cg.key === 'RRP')
    if (!rrp) {
        res.status(200).send(`No RRP in customer group list`)
        logger.error(`No RRP in customer group list`)
        return
    }
    // console.log(customerGroupList)

    // const actions = []
    for (const e of effects) {
        const effect = e.props.payload
        if (effect.company === '' || effect.journey === '') continue

        const customerGroupID = getCustomerGroupKey(effect)
        // const customerGroupID = customerGroupList.find((cg: any) => cg.key === getCustomerGroupKey(effect))?.id || null
        // console.log(customerGroupID)
        // if (!customerGroupID) continue

        const productID = effect.commercetools_product_id
        const product = (productID in products) ? products[productID] : await buildProduct(productID)
        const sku = product[effect.sku]
        // const rrpPrices = sku
        // console.log(sku)
        // return

        // const sku = variant.find((data: any) => data.sku === effect.sku)
        // if (!sku) continue

        // const rrpPrices = sku.prices.filter((price: any) => {
        //     return price.customerGroup.id === RRP.id
        // })

        // const rrpPrices: Array<any> = [];
        // const otherPrices: Array<any> = [];

        // sku.prices.forEach((price: any) => {
        //     if (price.customerGroup.id === RRP.id) rrpPrices.push(price)
        //     else otherPrices.push(price)
        // })

        // console.log(otherPrices)

        // if (rrpPrices.length < 1) continue

        for (const price of sku.rrpPrices) {
            const action = await wrapPayload(customerGroupID, sku.id, price, Number(effect.total_discount_amount))
            productsDraft[productID].actions.push(action)
        }
    }

    for (const productID in productsDraft) {
        const result = await updateProduct(productID, productsDraft[productID])
        logger.info(`Update Product ${productID}: ${JSON.stringify(result)}`)
    }

    products = {}
    res.status(200).send()
    // console.log(productsDraft)
    // res.status(200).send({productsDraft})

    // let effect

    // if (!effect) {
    //     res.status(200).send()
    //     return
    // }


    // } catch (error) {
    //     logger.error(`Bad request: ${error}`)
    //     res.status(500).send()
    //     return
    // }
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
                key: customerGroupID
            },
            ...validFrom,
            ...validUntil
        }
    }
}

const buildProduct = async (id: string) => {
    const query = await queryProducts(id)
    const data = query[0].masterData.staged
    const variants = [data.masterVariant].concat(data.variants)
    const rrpId = "371c835e-3929-4d99-85ce-f29f85d5096a"

    variants.forEach((variant: any) => {
        const rrpPrices: Array<any> = []
        const otherPrices: Array<any> = []

        variant.prices.forEach((price: any) => {
            if (price.customerGroup.id === rrpId) rrpPrices.push(price)
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
