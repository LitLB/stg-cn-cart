
import { commercetoolsOrderClient } from '../adapters/ct-order-client';
import { HTTP_STATUSES } from '../constants/http.constant';
import { IOrder } from '../interfaces/order.interface';
import { createStandardizedError } from '../utils/error.utils';

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
}