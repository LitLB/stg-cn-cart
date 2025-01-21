// cart/src/controllers/order.controller.ts

import { NextFunction, Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { RESPONSE_MESSAGES } from '../constants/messages.constant';
import { ApiResponse } from '../interfaces/response.interface';
import { logger } from '../utils/logger.utils';
import { IOrder } from '../interfaces/order.interface';
import { HTTP_STATUSES } from '../constants/http.constant';
import { commercetoolsOrderClient } from '../adapters/ct-order-client';
import { createStandardizedError } from '../utils/error.utils';
import Joi from 'joi';
import { OrderHistoryResult } from '../types/services/order.type';

export class OrderController {
    private orderService: OrderService;

    constructor() {
        this.orderService = new OrderService();
    }

    public getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;

            const cart = await this.orderService.getOrderById(id);

            const response: ApiResponse<IOrder> = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: cart,
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`OrderController.getOrderById.error`, error);

            next(error);
        }
    };

    public setTncOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const body = req.body
            const { orderId } = req.params;

            logger.info(`Accept T&C Request: ${JSON.stringify(body)}`)

            const { error } = bodySchema.validate(body, { abortEarly: false });

            if (error) {
                res.status(400).send({ errors: error.details.map((err) => err.message) });
                return;
            }

            const expand = ["custom.fields.termAndCondition"];
            const order = await this.orderService.getOrderByIdWithExpand(orderId, expand);

            const payload = {
                "container": "termAndCondition",
                "key": orderId,
                "value": body
            }
            const resultCustomObj = await commercetoolsOrderClient.createOrUpdateCustomObject(payload);

            if (!resultCustomObj) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: `Update CustomObject`,
                    errorCode: "UPDATE_OR_CREATE_CUSTOM_OBJECT_ON_CT_FAILED",
                    data: payload
                });
            }

            if (!order?.custom?.fields?.termAndCondition?.id) {
                const customObjId = resultCustomObj?.id;
                const payload = this.orderService.wrapCustomFieldTnc(order.version, customObjId);
                const orderResult = await commercetoolsOrderClient.updateOrder(orderId, payload);
                if (!orderResult) {
                    throw createStandardizedError({
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: `Update order ID ${orderId}`,
                        errorCode: "UPDATE_ORDER_ON_CT_FAILED",
                        data: {
                            orderId,
                            payload
                        }
                    });
                }
            }

            const response = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error(`OrderController.setTncOrder.error`, error);
            next(error);
        }
    }


    public getOrderTracking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { orderNumber } = req.params;
            const lang = req.get('Accept-Language');

            const orderHistories = await this.orderService.getOrderTrackingByOrderNumber(orderNumber, lang);

            const response: ApiResponse<OrderHistoryResult[]> = {
                statusCode: HTTP_STATUSES.OK,
                statusMessage: RESPONSE_MESSAGES.SUCCESS,
                data: orderHistories,
            };

            res.status(200).json(response);
            return
        } catch (error: any) {
            logger.error(`OrderController.getOrderHistory.error`, error);
            next(error);
        }
    }
}

const itemSchema = Joi.object({
    entryUid: Joi.string().required().messages({
        'string.empty': 'entryUid must be a non-empty string.',
        'any.required': 'entryUid is required.'
    }),
    entryVersion: Joi.number().required().messages({
        'number.base': 'entryVersion must be a number.',
        'any.required': 'entryVersion is required.'
    }),
    entryLanguage: Joi.string().required().messages({
        'string.empty': 'entryLanguage must be a non-empty string.',
        'any.required': 'entryLanguage is required.'
    }),
    acceptTnC: Joi.boolean().required().messages({
        'boolean.base': 'acceptTnC must be a boolean.',
        'any.required': 'acceptTnC is required.'
    }),
    schema: Joi.number().required().messages({
        'number.base': 'schema must be a number.',
        'any.required': 'schema is required.'
    }),
});

const bodySchema = Joi.array().items(itemSchema).required().messages({
    'array.base': 'body must be an array.',
    'any.required': 'body is required.'
});