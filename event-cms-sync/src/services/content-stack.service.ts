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

    logger.info(`Request create entry: ${JSON.stringify(entry)}`)
    logger.info(`Response create entry: ${JSON.stringify(response)}`)
    return;
  } catch (error) {
    logger.info(`Request create entry: ${JSON.stringify(payload)}`)
    logger.error(`Error create entry: ${error}`);
  }
}

export const updateEntry = async (entryUID: string, payload: any): Promise<any> => {
  try {
    const locales = await getLocales();
    const entry = await client.stack(stack).contentType(content_type_uid).entry(entryUID).fetch();
    const response = await Promise.all(locales.map(async (locale: string) => {
      entry.product_name = payload[locale]?.product_name;
      entry.main_category = payload[locale]?.main_category;
      entry.sub_category = payload[locale]?.sub_category;
      entry.main_image_group = payload[locale]?.main_image_group;
      entry.variant_images = payload[locale]?.variant_images;
    
      return entry.update({ locale });
    }));

    logger.info(`Request update entry: ${JSON.stringify(payload)}`)
    logger.info(`Response update entry: ${JSON.stringify(response)}`)
    return;
  } catch (error) {
    logger.info(`Request update entry: ${JSON.stringify(payload)}`)
    logger.error(`Error update entry: ${error}`);
  }
}

export const deleteEntry = async (entryUID: string): Promise<any> => {
  try {
    const response = await client.stack(stack).contentType(content_type_uid).entry(entryUID).delete();

    logger.info(`Request delete entry: ${JSON.stringify(entryUID)}`)
    logger.info(`Response delete entry: ${JSON.stringify(response)}`)
    return;
  } catch (error) {
    logger.info(`Request delete entry: ${JSON.stringify(entryUID)}`)
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
            'campaign_group': 'mass'
          }
        }).find();
  
      return entry.items;
    } catch (error) {
      logger.info(`Request: ${JSON.stringify(productID)}`)
      logger.error(`Error fetching entry: ${error}`);
    }
};

export const createTaxonomy = async (taxonomyUid: string): Promise<any> => {
  try {
    const taxonomy = {
      uid: taxonomyUid,
      name: taxonomyUid,
      description: '-'
    }
    await client.stack(stack)
    .taxonomy()
    .create({taxonomy});

    logger.info(`Response: Successfully created Taxonomy: ${JSON.stringify(taxonomy)}`);
    return;

  } catch (error) {
    logger.info(`Request: ${JSON.stringify(taxonomyUid)}`);
    logger.error(`Error creating taxonomy: ${error}`);
    throw error;
  }
}

export const getTaxonomy = async (taxonomyUid: string): Promise<any> => {
  try {
    const term = await client.stack(stack)
        .taxonomy(taxonomyUid)
        .terms()
        .query()
        .find();
    
    return term;
  } catch (error) {
    return;
  }
}

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
    logger.error(`Error fetching term taxonomy: ${error}`);
  }
};

export const createTermsOfTaxonomy = async (taxonomyUid: string, termUid: string = 'mass'): Promise<any> => {
  try {
    const term = {
      term: {
        uid: termUid,
        name: termUid,
        order: 1 
      }
    };

    const result = await client.stack(stack)
      .taxonomy(taxonomyUid)
      .terms()
      .create(term);

    logger.info(`Response: Successfully created term: ${JSON.stringify(result)}`);
    return result; 

  } catch (error) {
    logger.info(`Request: ${JSON.stringify(taxonomyUid)}`);
    logger.error(`Error creating term in taxonomy: ${error}`);
    throw error;
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
  const locales = await getLocales();

  for (const locale of locales) { 
    const data = { 
      publishDetails: {
        locales: [locale],
        environments: environments 
      },
      locale: locale 
    };

    try {
      const response = await client.stack(stack)
        .contentType(content_type_uid)
        .entry(entryUID)
        .publish(data);
  
      logger.info(`Request publish: ${JSON.stringify(data)}`);
      logger.info(`Response publish: ${JSON.stringify(response)}`);
    } catch (error) {
      logger.info(`Request publish: ${JSON.stringify(entryUID)}`)
      logger.error(`Error publishing entry for locale: ${locale}, Error: ${error}`);
    }
  }
}

export const unPublish = async (entryUID: string): Promise<any> => {
  const locales = await getLocales();

  for (const locale of locales) {
    const data = { 
      publishDetails: {
        locales: [locale],
        environments: environments 
      },
      locale: locale 
    };

    try {
      const response = await client.stack(stack)
        .contentType(content_type_uid)
        .entry(entryUID)
        .unpublish(data);
  
      logger.info(`Request unpublish: ${JSON.stringify(data)}`);
      logger.info(`Response unpublish: ${JSON.stringify(response)}`);
    } catch (error) {
      logger.info(`Request unpublish: ${JSON.stringify(entryUID)}`)
      logger.error(`Error unpublish entry for locale: ${locale}, Error: ${error}`);
    }
  }
}