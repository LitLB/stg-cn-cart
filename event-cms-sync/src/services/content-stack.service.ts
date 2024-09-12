import * as contentstack from '@contentstack/management'
import { logger } from '../utils/logger.utils';
import { contentStackConfig } from '../utils/config.utils';

const {
    api_key,
    authorization, 
    branch,
    content_type_uid,
    environments
} = contentStackConfig(); 

const client = contentstack.client({ authtoken: authorization });
const stack = {
    api_key: api_key,
    management_token: authorization, 
    branch_uid: branch
}

export const createEntry = async (payload: any): Promise<any> => {
  try {
    const entry = payload;
    const response = await client.stack(stack).contentType(content_type_uid).entry().create({ entry });

    logger.info(`Request: ${JSON.stringify(entry)}`)
    logger.info(`Response: ${JSON.stringify(response)}`)
    return;
  } catch (error) {
    logger.info(`Request: ${JSON.stringify(payload)}`)
    logger.error(`Error create entry: ${error}`);
  }
}

export const updateEntry = async (entryUID: string, payload: any): Promise<any> => {
  try {
    const locales = await getLocales();
    const entry = await client.stack(stack).contentType(content_type_uid).entry(entryUID).fetch();
    const response = await Promise.all(locales.map(async (locale: string) => {
      entry.product_name = payload[locale]?.product_name;
      entry.main_image_group = payload[locale]?.main_image_group;
      entry.variant_images = payload[locale]?.variant_images;
    
      return entry.update({ locale });
    }));

    logger.info(`Request: ${JSON.stringify(payload)}`)
    logger.info(`Response: ${JSON.stringify(response)}`)
    return;
  } catch (error) {
    logger.info(`Request: ${JSON.stringify(payload)}`)
    logger.error(`Error update entry: ${error}`);
  }
}

export const deleteEntry = async (entryUID: string): Promise<any> => {
  try {
    const response = await client.stack(stack).contentType(content_type_uid).entry(entryUID).delete();

    logger.info(`Request: ${JSON.stringify(entryUID)}`)
    logger.info(`Response: ${JSON.stringify(response)}`)
    return;
  } catch (error) {
    logger.info(`Request: ${JSON.stringify(entryUID)}`)
    logger.error(`Error delete entry: ${error}`);
  }
}

export const getContentStackEntry = async (productID: string): Promise<any> => {
    try {
      const entry = await client.stack(stack)
        .contentType(content_type_uid)
        .entry().query({
          query: {
            'commerce_tools_id': productID,
            'taxonomies.term_uid': 'mass',
            'taxonomies.taxonomy_uid': 'campaign_group'
          }
        }).find();
  
      return entry.items;
    } catch (error) {
      logger.info(`Request: ${JSON.stringify(productID)}`)
      logger.error(`Error fetching entry: ${error}`);
    }
};

export const getTermsOfTaxonomy = async (taxonomyUid: string): Promise<any> => {
    try {
      const term = await client.stack(stack)
          .taxonomy(taxonomyUid)
          .terms()
          .query()
          .find();
      
      return term.items.map((term) => term.name);
    } catch (error) {
      logger.info(`Request: ${JSON.stringify(taxonomyUid)}`)
      logger.error(`Error fetching taxonomy: ${error}`);
    }
};

export const getLocales = async (): Promise<any> => {
    try {
      const locales = await client.stack(stack)
        .locale()
        .query()
        .find()
        .then((result: any) => {
          return result.items;  // Fetches the locales array
        })
        .catch((error: any) => {
          console.error('Error fetching locales:', error);
        });

      return locales.map((locale: { code: string }) => locale.code);
    } catch (error) {
      logger.error(`Error fetching locales: ${error}`);
    }
}

export const publish = async (entryUID: string): Promise<any> => {
  try {
    const entry = {
      locales: await getLocales(),
      environments: environments
    }; 
    const response = await client.stack(stack)
      .contentType(content_type_uid)
      .entry(entryUID)
      .publish({ publishDetails: entry})

    logger.info(`Request: ${JSON.stringify(entry)}`)
    logger.info(`Response: ${JSON.stringify(response)}`)
    return;
  } catch (error) {
    logger.info(`Request: ${JSON.stringify(entryUID)}`)
    logger.error(`Error publish entry: ${error}`);
  }
}

export const unPublish = async (entryUID: string): Promise<any> => {
  try {
    const entry = {
      locales: await getLocales(),
      environments: environments
    }; 
    const response = await client.stack(stack)
      .contentType(content_type_uid)
      .entry(entryUID)
      .unpublish({ publishDetails: entry})
 
    logger.info(`Request: ${JSON.stringify(entry)}`)
    logger.info(`Response: ${JSON.stringify(response)}`)
    return;
  } catch (error) {
    logger.info(`Request: ${JSON.stringify(entryUID)}`)
    logger.error(`Error unPublish entry: ${error}`);
  }
}