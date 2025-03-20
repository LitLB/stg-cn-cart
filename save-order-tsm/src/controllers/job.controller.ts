import { Request, Response } from 'express';
import { logger } from '../utils/logger.utils';
import { readConfiguration } from '../utils/config.utils';
import * as jobService from '../services/job.service';
import { createLogModel, LogModel, logService } from '../utils/logger.utils';
import { LOG_APPS } from '../constants/log.constant';
import { EXCEPTION_MESSAGES, RESPONSE_MESSAGES } from '../utils/messages.utils';
import { ResponseType } from '../types/response.type';
import * as _ from 'lodash';

// TODO: implement code here    
/**
 * Exposed job endpoint.
 *
 * @param req The express request
 * @param res The express response
 * @returns
 */
export const saveOrderTSMController = async (req: Request, res: Response) => {
    const logModel = createLogModel(LOG_APPS.STG_CN_CART, "");
    
    let status = 500,
        response: ResponseType = {
            statusCode: 0,
            statusMessage: '',
            data: null
        };
    
    if (readConfiguration().isDisabledCron) {
        logger.info(`${LOG_APPS.STG_CN_CART} order-payment-notification is disabled`);
        res.status(200).send()
        return
    }

    try {
        LogModel.initialize(logModel);
        logger.info(`${LOG_APPS.STG_CN_CART} Job tsm :start`);

        const result = await jobService.saveOrderTSMService()

        status = _.get(result, 'success') == 200 ? 200 : 400;
        const message = status === 200 ? RESPONSE_MESSAGES.SUCCESS : EXCEPTION_MESSAGES.BAD_REQUEST;
        response = {
            statusCode: status,
            statusMessage: message,
            data: result?.response || []
        };

        logService(req.body, response, logModel);

        res.status(200).send(response)
    } catch (error : any) {
        const statusCode = error.statusCode || 500;
        const statusMessage = error.statusMessage || EXCEPTION_MESSAGES.SERVER_ERROR;
        const errorCode = error.errorCode;
        const data = error.data || null;
        const response = {
            statusCode,
            statusMessage,
            errorCode,
            data
        }
        logService(req.body, response, logModel);

        res.status(statusCode).send(response)
    }
};
