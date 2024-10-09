import axios from 'axios'
import { ETLConfig } from '../utils/config.utils';
import { logger } from '../utils/logger.utils'

export const callPDPWorkflow = async (campaigns: any) => {
    axios({
        method: 'post',
        url: ETLConfig().clientUrl,
        data: {
            workflowName: 'CMSPDPCampaign',
            workflowId: `ETL-CMS-PDP-Campaign-${ Date.now() }`,
            taskQueue: 'cms-pdp-campaign-task-queue',
            input: campaigns
        }
    })
    .then((res: any) => {
        logger.info(`Call cms-pdp-campaign-task-queue status: ${res.status} data: ${JSON.stringify(res.data)}`)
    })
    .catch((err: any) => {
        logger.error(`Call cms-pdp-campaign-task-queue error: ${err}`)
    })
}