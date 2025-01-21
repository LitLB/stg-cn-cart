
import { State } from '@commercetools/platform-sdk';
import { commercetoolsOrderClient } from '../adapters/ct-order-client';
import { dynamoClient } from '../adapters/dynamodb-client';
import { HTTP_STATUSES } from '../constants/http.constant';
import { IOrder } from '../interfaces/order.interface';
import { createStandardizedError } from '../utils/error.utils';
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { GetAllOrderStatesResult, OrderHistoryItem, OrderHistoryResult } from '../types/services/order.type';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { LOCALES } from '../constants/locale.constant';

export class OrderService {
    public getOrderById = async (id: string): Promise<IOrder> => {
        try {
            const ctOrder = await commercetoolsOrderClient.getOrderById(id);
            if (!ctOrder) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'Order not found.',
                }, 'getOrderById');
            }
            const iOrder = commercetoolsOrderClient.mapOrderToIOrder(ctOrder);

            return iOrder;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError({
                statusCode: 500,
            }, 'getOrderById');
        }
    }


    public getOrderByIdWithExpand = async (id: string, expand: any): Promise<any> => {
        try {
            const ctOrder = await commercetoolsOrderClient.getOrderWithExpand(id, expand);
            if (!ctOrder) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'Order not found.',
                }, 'getOrderById');
            }

            return ctOrder;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError({
                statusCode: 500,
            }, 'getOrderById');
        }
    }

    public wrapCustomFieldTnc = (version: number, customObjId: string) => {
        return {
            version,
            actions: [
                {
                    "action": "setCustomField",
                    "name": "termAndCondition",
                    "value": {
                        "typeId": "key-value-document",
                        "id": customObjId
                    }
                }
            ]
        }
    }

    private getAllOrderStates = async (states: OrderHistoryItem[]): Promise<GetAllOrderStatesResult> => {
        if (!states) {
            return {}
        }

        const allStateMap: Set<string> = new Set()
        states.forEach((item: any) => {
            if (item.prevStateId) {
                allStateMap.add(item.prevStateId)
            }
            if (item.currentStateId) {
                allStateMap.add(item.currentStateId)
            }
        })
        const statesIds = Array.from(allStateMap)

        const _states = await commercetoolsOrderClient.getStates(statesIds)

        const result: GetAllOrderStatesResult = {}
        _states.forEach((state: State) => {
            result[state.id] = state
        })

        return result
    }

    private formatOrderHistory = (records: Record<string, AttributeValue>[], states: GetAllOrderStatesResult, sort: string, lang?: string): OrderHistoryResult[] => {
        const result = records
            .map((item: Record<string, AttributeValue>) => unmarshall(item) as OrderHistoryItem)
            .sort((i1: OrderHistoryItem, i2: OrderHistoryItem) => {
                if (sort.toLocaleLowerCase() === 'asc') {
                    return i1.sequenceNumber - i2.sequenceNumber
                } else {
                    return i2.sequenceNumber - i1.sequenceNumber
                }
            })
            .map((item: OrderHistoryItem): OrderHistoryResult => {
                let previousState: OrderHistoryResult['current']['state'] = null
                let currentState: OrderHistoryResult['current']['state'] = null

                if (item.fieldChanged === 'order_state_transition') {
                    const _previousState = states[item.prevStateId] || null
                    const _currentState = states[item.currentStateId] || null

                    previousState = {
                        id: _previousState.id,
                        key: _previousState.key,
                        [LOCALES.TH_TH]: _previousState.name ? _previousState.name['th'] : 'UNKNOWN',
                        [LOCALES.EN_US]: _previousState.name ? _previousState.name['en'] : 'UNKNOWN',
                    }

                    currentState = {
                        id: _currentState.id,
                        key: _currentState.key,
                        [LOCALES.TH_TH]: _currentState.name ? _currentState.name['th'] : 'UNKNOWN',
                        [LOCALES.EN_US]: _currentState.name ? _currentState.name['en'] : 'UNKNOWN',
                    }
                }

                return {
                    id: item.id,
                    orderId: item.orderId,
                    orderNumber: item.orderNumber,
                    stateType: item.fieldChanged,
                    previous: {
                        status: item.prevStatus,
                        state: previousState
                    },
                    current: {
                        status: item.currentStatus,
                        state: currentState
                    },
                    lastModified: item.lastModified,
                }
            })

        return result
    }

    public getOrderTrackingByOrderNumber = async (orderNumber: string, sort = 'desc', lang = 'en-US'): Promise<OrderHistoryResult[]> => {
        try {
            if (!orderNumber) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Order number is required.',
                }, 'getOrderTrackingByOrderNumber');
            }

            // TODO: table name suffix by env
            const records = await dynamoClient.scanItem({
                tableName: 'true-ecommerce-order-history-dev',
                filterExpression: 'orderNumber = :orderNumber',
                expressionAttributeValues: {
                    ':orderNumber': marshall(orderNumber)
                }
            })

            if (!records || !records.Items || records.Items.length === 0) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'Order history not found.',
                }, 'getOrderHistory');
            }

            const statesProcessing: OrderHistoryItem[] = []
            records.Items.forEach((item) => {
                const _item = unmarshall(item) as OrderHistoryItem
                if (_item.fieldChanged === 'order_state_transition' && _item.currentStateId) {
                    statesProcessing.push(_item)
                }
            })
            const states = await this.getAllOrderStates(statesProcessing)

            const results = this.formatOrderHistory(records.Items, states, sort, lang)
            return results
        } catch (error: any) {
            // TODO: Handle more error
            if (error.status && error.message) {
                throw error;
            }
            throw error;
        }
    }
}