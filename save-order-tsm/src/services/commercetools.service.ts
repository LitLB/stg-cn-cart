import { Cart, CustomObject, Order } from '@commercetools/platform-sdk'
import { createApiRoot } from '../client/create.client.js'
import { logger } from '../utils/logger.utils.js'

const apiRoot = createApiRoot()

export const getOrders = async (queryArgs: any) => {
    try {
        const { body } = await apiRoot
            .orders()
            .get({ queryArgs })
            .execute()

        return body
    } catch (error) {
        logger.error(`Get orders ${error}`)
        return null
    }
}

export const updateOrder = async (orderID: string, actions: any) => {
    try {
        const { body } = await apiRoot
            .orders()
            .withId({ ID: orderID })
            .post({ body: actions })
            .execute()

        return body
    } catch (error: any) {
        logger.error(`Update order ID ${orderID} ${error}`)
        return null
    }
}

export const getBulkOrderNotSaveOnTSM = async (): Promise<Order[]> => {
    try {
        const { body } = await apiRoot
            .orders()
            .get({
                queryArgs: {
                    where: `custom(fields(tsmOrderIsSaved=false)) and paymentState="Paid"`,
                    expand: [
                        "custom.fields.couponsInfomation",
                        "cart"
                    ],
                }
            })
            .execute()

        return body.results
    } catch (error) {
        logger.error(`Get orders ${error}`)
        return []
    }
}

export const getCustomObjectByContainerAndKey = async (
    container: string,
    key: string,
): Promise<CustomObject | null> => {
    try {
        const { body } = await apiRoot
            .customObjects()
            .withContainerAndKey({ container, key })
            .get()
            .execute();

        return body
    } catch (error) {
        logger.error(`getCustomObjectByContainerAndKey ${error}`)
        return null
    }
}

export const getCouponInformation = async (orderNumber: string, container: string, cartId: string) => {
    let couponResult: any[] = []
    try {
        const customObjectCouponInformation = await getCustomObjectByContainerAndKey(container, cartId)
        if (customObjectCouponInformation) {
            couponResult = customObjectCouponInformation.value
        }
    } catch (error: any) {
        logger.error(`CartService.createOrder.getCouponInformation.error`, error);
        return { discounts: [], otherPayments: [] }
    }

    const discounts: { id: string; no: string; code: string; amount: string; serial: string }[] = [];
    const otherPayments: { id: string; no: string; code: string; amount: string; serial: string }[] = [];
    let discountNo = 1;
    let otherPaymentNo = 1;

    couponResult.forEach((item: any) => {

        if (item.discountCode.toUpperCase() !== "NULL") {
            discounts.push({
                id: orderNumber,
                no: discountNo.toString(),
                code: item.couponCode,
                amount: item.discountPrice.toString(),
                serial: "",
            });
            discountNo++;
        }

        if (item.otherPaymentCode.toUpperCase() !== "NULL") {
            otherPayments.push({
                id: orderNumber,
                no: otherPaymentNo.toString(),
                code: item.otherPaymentCode,
                amount: item.discountPrice.toString(),
                serial: "",
            });
            otherPaymentNo++;
        }
    });

    return { discounts, otherPayments };
}

export const bulkUpdateOrderIsSavedOnTSM = async (orderIds: string[]) => {
    try {
        const { body } = await apiRoot
            .orders()
            .post({
                queryArgs: {
                    where: `id in ("${orderIds.join('","')}")`,
                },
                body: {
                    custom: {
                        type: {
                            typeId: "custom",
                            id: "order"
                        },
                        fields: {
                            tsmOrderIsSaved: true
                        }
                    }
                }
            })
            .execute()

        return body
    } catch (error) {
        logger.error(`bulkUpdateOrder ${error}`)
        return null
    }
}

export const getCartById = async (cartId: string): Promise<Cart | null> => {
    try {
        const response = await apiRoot
            .carts()
            .withId({ ID: cartId })
            .get()
            .execute();

        return response.body;

    } catch (error: any) {
        logger.error(`Error fetching cart with ID ${cartId}:`, error.message);
        return null;
    }
}