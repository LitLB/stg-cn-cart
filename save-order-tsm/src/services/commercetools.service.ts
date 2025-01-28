import { Cart, CustomObject, Order, OrderUpdateAction } from '@commercetools/platform-sdk'
import { createApiRoot } from '../client/create.client.js'
import { logger } from '../utils/logger.utils.js'
import { CouponInformationAttributes, GetCouponInformationResult } from '../types/services/commercetools.type.js'
import { CreateTSMSaleOrderResponse } from '../types/services/tsm.type.js'

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
        logger.error(`getCustomObjectByContainerAndKey:${error}`)
        return null
    }
}

export const getCouponInformation = async (orderNumber: string, container: string, cartId: string): Promise<GetCouponInformationResult> => {
    let couponResult: any[] = []
    try {
        const customObjectCouponInformation = await getCustomObjectByContainerAndKey(container, cartId)
        if (customObjectCouponInformation) {
            couponResult = customObjectCouponInformation.value
        }
    } catch (error: any) {
        logger.error(`getCouponInformation:error:${error}`);
        return {
            discounts: [],
            otherPayments: []
        }
    }

    const discounts: CouponInformationAttributes[] = [];
    const otherPayments: CouponInformationAttributes[] = [];
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

export const updateOrderIsSavedOnTSM = async (order: Order, isSuccess: boolean, tsmResponse?: CreateTSMSaleOrderResponse) => {
    try {
        const actions: OrderUpdateAction[] = [
            {
                action: "setCustomField",
                name: "tsmOrderIsSaved",
                value: isSuccess,
            }, {
                action: "setCustomField",
                name: "tsmOrderResponse",
                value: JSON.stringify(tsmResponse?.response || { message: 'unknown error' }),
            },
        ]

        if (isSuccess) {
            actions.push({
                action: "changeShipmentState",
                "shipmentState": "Pending"
            })
        }

        const { body } = await apiRoot
            .orders()
            .withId({ ID: order.id })
            .post({
                body: {
                    version: order.version,
                    actions: actions,
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