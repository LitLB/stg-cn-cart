import { CustomObjectDraft, ErrorResponse, Order, OrderUpdate, StateReference } from "@commercetools/platform-sdk"
import { createLogModel, LogModel, logService } from "../utils/logger.utils"
import { readConfiguration } from "../utils/config.utils"
import { CommercetoolsOrderClient } from "../adapters/ct-order-client"
import { CommercetoolsCustomObjectClient } from "../adapters/ct-custom-object-client"
import {STATE_ORDER_KEYS } from '../constants/state.constant'
import _ from "lodash"
import { LOG_APPS } from "../constants/log.constant"
import { ORDER_ERROR } from "../constants/ct.constant"


export class SharedService {
    private ctOrderClient
    private ctCustomObjectClient

    constructor(
        commercetoolsOrderClient: CommercetoolsOrderClient,
        commercetoolsCustomObjectClient: CommercetoolsCustomObjectClient,
    ) {
        this.ctOrderClient = commercetoolsOrderClient
        this.ctCustomObjectClient = commercetoolsCustomObjectClient
    }

    public async updateOrderStatusByIdWithRetry(
        orderId: string,
        stateKey: STATE_ORDER_KEYS,
        _payload: OrderUpdate,
        options?: {
            logStep?: LogModel,
            logAppName?: string,
            logMessageName?: string,
            logInstant?: LogModel,
        },
    ): Promise<{ success: boolean; data: any; error?: any }> {
        const logStepModel = options?.logStep || createLogModel(
            options?.logAppName || LOG_APPS.STG_CN_CART,
            options?.logMessageName,
            options?.logInstant || LogModel.getInstance(),
        )
        const maxRetry = Number(readConfiguration().ctMaxRetry)

        const payload = _.cloneDeep(_payload)
        let order: Order | undefined
        let attempt = 0
        let isSuccess = false
        let updateResult = {}
        let error: any = {}

        while (attempt <= maxRetry) {
            // step 1. check order status 
            order = await this.ctOrderClient.getOrderById(orderId)

            // step 2. check prev order status is correct.
            // if order status not match then break and save to custom object
            // if (!this.validateStateBeforeUpdate(order, stateKey)) {
            //     Object.assign(error, { message: 'Invalid order state', statusCode: 400 })
            //     break
            // }

            // step 3. update order
            Object.assign(payload, { version: order.version })
            const response = await this.ctOrderClient.updateOrderById(orderId, payload)

            if (response.success) {
                updateResult = response.response
                isSuccess = response.success
                break
            }

            // step 4. check if order diff order version
            if (response.response.statusCode === 409 && response.response.name === 'ConcurrentModification') {
                Object.assign(response, { statusCode: response.response.statusCode })
                logService(order, response, logStepModel)
                const _error = response.response as ErrorResponse
                error = _error
                attempt++
            }
        }
        // !!alt. order update not success or invalid status
        if (!isSuccess && error) {
            if (attempt >= maxRetry) {
                const msgMaxRetry = 'Maximum retries reached. Update failed due to concurrent modification.'
                Object.assign(error, { message: msgMaxRetry, statusCode: 500 })
            }

            const customObject: CustomObjectDraft = {
                container: ORDER_ERROR,
                key: orderId,
                value: {
                    orderNumber: order?.orderNumber,
                    errorStep: stateKey,
                    errorCode: error.statusCode,
                    errorMessage: JSON.stringify(error.message),
                    previousStateId: order?.state?.id,
                    previousStep: order?.state?.obj?.key
                }
            }

            await this.ctCustomObjectClient.createOrUpdateCustomObject(customObject)
        }

        return {
            success: isSuccess,
            data: updateResult,
            error: error,
        }
    }
}
