import { createApiRoot } from '../client/create.client.js';

const apiRoot = createApiRoot()

export const queryProducts = async (productID: string) => {
    const { body: { results: products } } = await apiRoot
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
    const { body: { results: customerGroups } } = await apiRoot
        .customerGroups()
        .get({
            queryArgs: {
                where: `id = "${customerGroupID}"`,
            },
        })
        .execute()

    return customerGroups[0]
}