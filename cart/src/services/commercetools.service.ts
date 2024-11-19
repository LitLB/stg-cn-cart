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
            .get({
                queryArgs: {
                    limit: 500,
                },
            })
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

export const queryCustomerGroup = async (key: string) => {
    try {
        const { body: { results: customerGroups } } = await apiRoot
            .customerGroups()
            .get({
                queryArgs: {
                    where: `key = "${key}"`,
                },
            })
            .execute()

        return customerGroups
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        return []
    }
}

export const createCustomerGroup = async (payload: any) => {
    try {
        const customerGroup = await apiRoot
            .customerGroups()
            .post({ body: payload })
            .execute()

        return customerGroup
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        return null
    }
}

export const deleteCustomerGroup = async (key: string, version: number) => {
    try {
        const customerGroup = await apiRoot
            .customerGroups()
            .withKey({ key: key })
            .delete({
                queryArgs: {
                  version: version,
                },
              })
            .execute()

        return customerGroup
    } catch (error) {
        logger.error(`Bad request: ${error}`)
        return null
    }
}