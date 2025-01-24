import TsmOrderModel from "../models/tsm-order.model"
import { readConfiguration } from "../utils/config.utils"
import { logger } from "../utils/logger.utils"
import { safelyParse } from "../utils/response.utils"
import * as apigeeService from "./apigee.service"


export const createTSMSaleOrder = async (orderNumber: string, cart: any, accessToken: string): Promise<> => {
    try {
        // const apigeeClientAdapter = new ApigeeClientAdapter
        const config = readConfiguration()
        // Get coupon information
        const couponDiscounts = await this.getCouponInformation(orderNumber, COUPON_INFO_CONTAINER, cart.id)
        const tsmOrder = new TsmOrderModel({ ctCart: cart, config, orderNumber, couponDiscounts })
        const tsmOrderPayload = tsmOrder.toPayload()

        const response = await apigeeService.saveOrderTSM({data: tsmOrderPayload, accessToken})

        if (!response) {
            return {
                success: false,
                response: { message: 'Internal Server Error' }
            }
        }

        const { code } = response || {}
        return {
            success: code === '0',
            response
        }

        if (code !== '0') {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED'
            };
        }

    } catch (error: any) {
        logger.info(`createTSMSaleOrder-error: ${JSON.stringify(error)}`)
        let data = error?.response?.data
        if (data) {
            data = safelyParse(data)
        }
        throw {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
            errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED',
            ...(data ? { data } : {})
        };
        return {
            success: false,
            response: data
        }
    }
}