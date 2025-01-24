import TsmOrderModel from "../models/tsm-order.model"
import { readConfiguration } from "../utils/config.utils"
import { logger } from "../utils/logger.utils"
import { safelyParse } from "../utils/response.utils"
import * as apigeeService from "./apigee.service"
import { CreateTSMSaleOrder } from "../types/services/tsm.type"
import * as commercetoolsService from "./commercetools.service"
import { COUPON_INFO_CONTAINER } from "../constants/ct.constant"
import { Order } from "@commercetools/platform-sdk"

export const createTSMSaleOrder = async (order: Order, accessToken: string): Promise<CreateTSMSaleOrder> => {
    try {
        const config = readConfiguration()

        const orderNumber = order.orderNumber!
        const cart = await commercetoolsService.getCartById(order.cart!.id)
        if (!cart) {
            return {
                success: false,
                response: { message: 'Internal Server Error' }
            }
        }

        // Get coupon information
        const couponDiscounts = await commercetoolsService.getCouponInformation(orderNumber, COUPON_INFO_CONTAINER, cart.id)
        const tsmOrder = new TsmOrderModel({ ctCart: cart, config, orderNumber, couponDiscounts })
        const tsmOrderPayload = tsmOrder.toPayload()
        logger.info(`tsmOrderPayload: ${JSON.stringify(tsmOrderPayload)}`)

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
    } catch (error: any) {
        logger.info(`createTSMSaleOrder-error: ${JSON.stringify(error)}`)
        let data = error?.response?.data
        if (data) {
            data = safelyParse(data)
        }
        
        return {
            success: false,
            response: data
        }
    }
}