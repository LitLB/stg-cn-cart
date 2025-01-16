import { Order } from '@commercetools/platform-sdk'
import { createApiRoot } from '../client/create.client.js'
import { logger } from '../utils/logger.utils.js'

const apiRoot = createApiRoot()

export const queryProducts = async (productID: string) => {
    const {
        body: { results: products },
    } = await apiRoot
        .products()
        .get({
            queryArgs: {
                where: `id = "${productID}"`,
            },
        })
        .execute()

    return products
}

export const queryCustomerGroup = async (customerGroupID: string) => {
    const {
        body: { results: customerGroups },
    } = await apiRoot
        .customerGroups()
        .get({
            queryArgs: {
                where: `id = "${customerGroupID}"`,
            },
        })
        .execute()

    return customerGroups[0]
}

export const queryOrderById = async (id: string, expandFields?: string[]): Promise<Order | null> => {
    try {
        const orderResponse = await apiRoot
            .orders()
            .withId({ ID: id })
            .get({
                queryArgs: {
                    ...(expandFields && { expand: expandFields }),
                },
            })
            .execute()

        if (orderResponse.statusCode !== 200) {
            return null
        }

        return orderResponse.body
    } catch (err) {
        logger.error(err)
        return null
    }
}
