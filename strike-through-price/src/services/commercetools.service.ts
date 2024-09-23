import { createApiRoot } from '../client/create.client.js'
import { logger } from '../utils/logger.utils'

const apiRoot = createApiRoot()

export const queryProducts = async (productID: string) => {
    try {
        const { body: { results: products } } = await apiRoot
            .products()
            .get({
                queryArgs: {
                    where: `id = "${productID}"`,
                },
            })
            .execute()

        return products
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        return []
    }
}

export const queryCustomerGroupList = async () => {
    try {
        const { body: { results: customerGroups } } = await apiRoot
            .customerGroups()
            .get()
            .execute()

        return customerGroups
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        return []
    }
}

export const updateProduct = async (productID: string, actions: any) => {
    try {
        const product = await apiRoot
            .products()
            .withId({ ID: productID })
            .post({ body: actions })
            .execute()

        return product
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        return null
    }
}