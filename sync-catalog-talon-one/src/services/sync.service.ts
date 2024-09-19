import { logger } from '../utils/logger.utils'
import { queryProducts, queryCustomerGroup } from '../services/commercetools.service'

export const buildData = (id: string, product: any, variantID?: number) => {
    const productName = getProductName(product.name)
    const actions: Array<any> = []

    const variants = [product.masterVariant].concat(product.variants)
    if (variantID) {
        const variant = variants.find((variant: any) => variant.id === variantID)
        actions.push(wrapPayload(id, productName, variant))
    } else {
        variants.forEach((variant: any) => {
            const action = wrapPayload(id, productName, variant)
            actions.push(action)
        })
    }

    return { actions }
}

export const buildRemoveData = (variants: any) => {
    const actions: Array<any> = []

    variants.forEach((variant: any) => {
        const action = wrapRemovePayload(variant.sku)
        actions.push(action)
    })

    return { actions }
}

export const buildRemoveManyData = (productID: string) => {
    const actions = [
        wrapRemoveManyPayload(productID)
    ]

    return { actions }
}

const wrapPayload = (id: string, name: string | null, variant: any) => {
    const attributes: { commercetools_product_id: string; capacity?: string } = {
        commercetools_product_id: id
    }
    const capacity = variant.attributes.find((item: any) => item.name === 'capacity')?.value?.label || null
    if (capacity)
        attributes.capacity = capacity

    const product = name ? { name } : null;

    return {
        payload: {
            replaceIfExists: true,
            sku: variant.sku,
            price: 0,
            ...(product ? { product } : {}),
            attributes
        },
        type: "ADD"
    }
}

const wrapRemovePayload = (sku: string) => {
    return {
        payload: {
            sku: sku
        },
        type: "REMOVE"
    }
}

const wrapRemoveManyPayload = (productID: string) => {
    return {
        payload: {
            filters: [
                {
                    attr: 'commercetools_product_id',
                    op: 'EQ',
                    value: productID
                }
            ]
        },
        type: "REMOVE_MANY"
    }
}

const getProductName = (obj: any) => {
    let productName = obj['th-TH'] ? obj['th-TH'] : obj['en-US']
    if (!productName)
        return null
    return productName.length > 50 ? productName.substring(0, 47) + '...' : productName
}

export const getProduct = (async (id: string) => {
    const products = await queryProducts(id)
    if (products.length < 1) {
        logger.info(`No Product: ${id}`)
        return
    }
    return products[0]?.masterData
})

export const isRRP = ( async (customerGroupID: string) => {
    if (!customerGroupID) return false
    const customerGroup = await queryCustomerGroup(customerGroupID)
    if (!customerGroup) return false
    return customerGroup.key?.toLocaleLowerCase() === 'rrp'
})