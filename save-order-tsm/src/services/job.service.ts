import { commercetoolsOrderClient } from '../adapters/ct-order-client';
import { CommercetoolsCustomObjectClient } from '../adapters/ct-custom-object-client'
import _ from 'lodash'
import { STATE_ORDER_KEYS } from "../constants/state.constant"
import { ORDER_STATES } from "../constants/order.constant"
import { PAYMENT_STATES } from "../constants/payment.constant"
import { SHIPMENT_STATES } from "../constants/shipment.constant"
import { createLogModel, logger, LogModel } from '../utils/logger.utils';
import { LOG_APPS, LOG_MSG } from '../constants/log.constant';
import { ResponseService } from '../interfaces/config.interface';

import { SharedService } from './shared.service'

const sharedService = new SharedService(commercetoolsOrderClient, CommercetoolsCustomObjectClient.getInstance());


export const saveOrderTSMService = async (): Promise<ResponseService> => {
    const logModel = LogModel.getInstance();
    const logStepModel = createLogModel(LOG_APPS.STG_CN_CART, LOG_MSG.ORDER_UPDATE, logModel);
    const response: ResponseService = { success: 200, response: '' };

    try {
        const stateData = await commercetoolsOrderClient.getStateByKey(STATE_ORDER_KEYS.PAYMENT_SUCCESS)
        const queryWhere = `state(id="${_.get(stateData, 'id')}") and orderState="${ORDER_STATES.OPEN}" and shipmentState="${SHIPMENT_STATES.PENDING}" and paymentState="${PAYMENT_STATES.PAID}" and custom(fields(tsmOrderIsSaved=false))`
        const orders = await commercetoolsOrderClient.getOrderFromQuery(queryWhere)

        logger.info(`${LOG_MSG.ORDER_UPDATE} Found ${orders.length} orders to process`)
        logger.info(`${LOG_MSG.ORDER_UPDATE} orders:[${orders.map(order => order.orderNumber).join(',')}]`)
        
        if (orders.length === 0) {
            return { success: 400, response: `${LOG_MSG.ORDER_UPDATE} Order not found` };
        }

        for (const order of orders) {
            logger.info(`${LOG_MSG.ORDER_UPDATE} Processing order: ${order.orderNumber}`);
            const orderId = order.id
            const stateKey = STATE_ORDER_KEYS.SAVE_ORDER;
            const orderPayload = await commercetoolsOrderClient.buildUpdateOrderTransitionState(order, stateKey);

            const updatedOrder = await sharedService.updateOrderStatusByIdWithRetry(orderId, stateKey, orderPayload, { logStep: logStepModel });

            if (!updatedOrder?.success) {
                logger.error(`${LOG_MSG.ORDER_UPDATE} Error Update Order: ${JSON.stringify(updatedOrder)}`);
            }else {
                logger.info(`${LOG_MSG.ORDER_UPDATE} Update Order Success : ${order.orderNumber}`);
            }

            logger.info(`${LOG_MSG.ORDER_UPDATE} End Processed order: ${order.orderNumber}`);

        }
        
        logger.info(`${LOG_MSG.ORDER_UPDATE} Update All Order is done`);
    } catch (error) {
        logger.error(`${LOG_MSG.ORDER_UPDATE} Failed to update`, error);

        return { success: 400, response: `${LOG_MSG.ORDER_UPDATE} Failed to update ` };
    }

    return response;
}