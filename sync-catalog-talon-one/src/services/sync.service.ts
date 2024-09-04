export const buildData = (id: string, product: any) => {
    const productName = product.name['en-US'] || ''
    const actions = [
        wrapPayload(id, productName, product.masterVariant)
    ]

    product.variants.forEach((variant: any) => {
        const action = wrapPayload(id, productName, variant)
        actions.push(action)
    })

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

const wrapPayload = (id: string, name: string, variant: any) => {
    return {
        payload: {
            replaceIfExists: true,
            sku: variant.sku,
            price: 0,
            product: {
                name
            },
            attributes: {
                commercetools_product_id: id,
                capacity: variant.attributes.find((item: any) => item.name === 'capacity')?.value?.label || null
            }
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