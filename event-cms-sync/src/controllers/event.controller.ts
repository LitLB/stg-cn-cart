import { Request, Response } from 'express';
import { logger } from '../utils/logger.utils';
import { cmsService } from '../services/content-stack-sync.service';

/**
 * Exposed event POST endpoint.
 * Receives the Pub/Sub message and works with it
 *
 * @param {Request} request The express request
 * @param {Response} response The express response
 * @returns
 */
export const eventController = async (request: Request, response: Response) => {
  const data = await cmsService.decodedData(request);
  logger.info(`Request event-cms-sync : ${data}`);

  try {
    const productID: string = data.resource?.id;

    if (!data) {
      throw new Error('Missing request body');
    }

    if (data.resource?.typeId !== 'product') {
      throw new Error('Invalid resource type: Expected product');
    }

    if (!productID) {
      throw new Error('Missing product id');
    }

    if (!data.notificationType) {
      throw new Error('Missing notification type');
    }

    const isService = await cmsService.isServiceType(productID);
    if (isService) return response.status(200).send(); 

    switch (data.notificationType) {
      case 'ResourceCreated':
        await cmsService.resourceCreated(productID);
        return response.status(200).send();
      case 'ResourceUpdated':
        await cmsService.resourceUpdated(productID);
        return response.status(200).send();
      case 'ResourceDeleted':
        await cmsService.resourceDeleted(productID);
        return response.status(200).send();
      default:
        throw new Error('Invalid notification type');
    }
  } catch (error) {
    logger.error(`Error ${data.notificationType} : ${data.resource}`);
    logger.error(`Error request : ${error}`);
    response.status(200).send()
    return;
  }
};
