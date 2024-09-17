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

export const queryCustomerGroupList = async () => {
    const { body: { results: products } } = await apiRoot
        .customerGroups()
        .get()
        .execute()
        
    return products
}

export const updateProduct = async (productID: string, actions: any) => {
    const product = await apiRoot
        .products()
        .withId({ID: productID})
        .post({body: actions})
        .execute()
        
    return product
}