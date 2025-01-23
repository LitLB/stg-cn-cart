import { Request, Response } from 'express';
import { logger } from '../utils/logger.utils';
import { readConfiguration } from '../utils/config.utils';
import * as jobService from '../services/job.service';

// TODO: implement code here    
/**
 * Exposed job endpoint.
 *
 * @param req The express request
 * @param res The express response
 * @returns
 */
export const saveOrderTSMController = async (req: Request, res: Response) => {
    // NOTE - Check if the job is disabled
    if (readConfiguration().isDisabledCron) {
        logger.info('order-payment-notification is disabled')
        res.status(200).send()
        return
    }

    try {
        logger.info('saveOrderTsm:start')

        const result = await jobService.saveOrderTSMService()

        logger.info('saveOrderTsm:done')
        res.status(200).send({ result })
    } catch (error) {
        logger.error(`saveOrderTsm:badRequest:${JSON.stringify(error)}`)
        res.status(500).send({ statusCode: 500, statusMessage: 'failed', message: error })
    }
};
