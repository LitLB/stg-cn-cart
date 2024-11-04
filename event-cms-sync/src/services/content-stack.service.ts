import * as contentstack from '@contentstack/management'
import { logger } from '../utils/logger.utils';
import { contentStackConfig } from '../utils/config.utils';
import * as https from 'https';
import * as fs from 'fs';

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

export const updateEntry = async (entries: any, payload: any): Promise<any> => {
  
    const locales = await getLocales();

    for (const entry of entries) {
      try {
        const response = await Promise.all(locales.map(async (locale: string) => {
          entry.product_name = payload[locale]?.product_name;
          entry.brand_name = payload[locale]?.brand_name
          entry.main_category = payload[locale]?.main_category;
          entry.sub_category = payload[locale]?.sub_category;
          entry.main_image_group = payload[locale]?.main_image_group;
          entry.variant_images = payload[locale]?.variant_images;
        
          return entry.update({ locale });
        }));

        logger.info(`Request update entry: ${JSON.stringify(payload)}`)
        logger.info(`Response update entry: ${JSON.stringify(response)}`)
      } catch (error) {
        logger.info(`Request update entry: ${JSON.stringify(payload)}`)
        logger.error(`Error update entry: ${error}`);
      }
    }
    return;
}

export const deleteEntry = async (entries: any): Promise<any> => {
  const locales = await getLocales();

  for (const entry of entries) {
    const entryUID = entry.uid;

    for (const locale of locales) {
      try {
        const response = await client.stack(stack)
          .contentType(content_type_uid)
          .entry(entryUID)
          .delete({ locale: locale });
    
        logger.info(`Request delete entry: ${JSON.stringify(entryUID)}`)
        logger.info(`Response deleted entry for locale: ${locale} : ${JSON.stringify(response)}`)
      } catch (error: any) {
        if (error?.errors?.locale.length > 0) continue;
        logger.info(`Request delete entry: ${JSON.stringify(entryUID)}`)
        logger.error(`Error delete entry: ${JSON.stringify(error.errors)}`);
      }
    }
  }
}

export const getContentStackCampaignEntry = async (productID: string, campaignGroup: string = 'mass'): Promise<any> => {
    try {
      const entry = await client.stack(stack)
        .contentType(content_type_uid)
        .entry().query({
          query: {
            'commerce_tools_id': productID,
            'campaign_group': campaignGroup
          }
        }).find();

      return entry.items;
    } catch (error) {
      logger.info(`Request: ${JSON.stringify(productID)}`)
      logger.error(`Error fetching entry: ${error}`);
    }
};

export const getContentStackAllCampaignEntry = async (productID: string): Promise<any> => {
  try {
    const entry = await client.stack(stack)
      .contentType(content_type_uid)
      .entry().query({
        query: {
          'commerce_tools_id': productID
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

export const publish = async (entries: any): Promise<any> => {
  const locales = await getLocales();

  for (const entry of entries) {
    const entryUID = entry.uid;

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
    
        logger.info(`Request publish: ${JSON.stringify(entryUID)} :${JSON.stringify(data)}`);
        logger.info(`Response publish: ${JSON.stringify(response)}`);
      } catch (error) {
        logger.info(`Request publish: ${JSON.stringify(entryUID)}`)
        logger.error(`Error publishing entry for locale: ${locale}, Error: ${error}`);
      }
    }
  }
}

export const unPublish = async (entries: any): Promise<any> => {
  const locales = await getLocales();

  for (const entry of entries) {
    const entryUID = entry.uid;

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
    
        logger.info(`Request unpublished: ${JSON.stringify(entryUID)} :${JSON.stringify(data)}`);
        logger.info(`Response unpublished: ${JSON.stringify(response)}`);
      } catch (error) {
        logger.info(`Request unpublished: ${JSON.stringify(entryUID)}`)
        logger.error(`Error unpublish entry for locale: ${locale}, Error: ${error}`);
      }
    }
  }
}

export const getAsset = async (sku: string): Promise<any> => {
  try {
    const asset = await client.stack(stack)
      .asset()
      .query({ query: { 'filename': `${sku}.jpg` } })
      .find();

    return asset?.items[0]?.uid ?? '';
  } catch (error) {
    logger.info(`Request: ${JSON.stringify(sku)}`)
    logger.error(`Error fetching asset: ${error}`);
  }
}

export const getFolderAsset = async (productID: string): Promise<any> => {
  try {
    const asset = await client.stack(stack)
      .asset()
      .query({ query: { 'is_dir': true, 'name': productID } })
      .find();
 
    return asset?.items[0]?.uid ?? '';
  } catch (error) {
    logger.info(`Request: ${JSON.stringify(productID)}`)
    logger.error(`Error fetching folder: ${error}`);
  }
}

export const createFolder = async (productID: string): Promise<any> => {
  try {
    const asset = { name: productID}
    const folder = await client.stack(stack).asset().folder().create({asset});

    return folder?.uid ?? '';
  } catch (error) {
    logger.info(`Request: ${JSON.stringify(productID)}`)
    logger.error(`Error create folder: ${error}`);
  }
}

export const uploadImage = async (uidFolder: string, imageUrl: string, sku : string): Promise<any> => {
  try {
     // Fetch the image as a Buffer
      const imageData: Buffer = await new Promise((resolve, reject) => {
        https.get(imageUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to get '${imageUrl}' (${response.statusCode})`));
            return;
          }

          const data: Uint8Array[] = [];
          response.on('data', (chunk) => {
            data.push(chunk);
          });

          response.on('end', () => {
            resolve(Buffer.concat(data));
          });
        }).on('error', (err) => {
          reject(err.message);
        });
      });

      // Save the buffer to a file
      const filePath = './' + sku.toLowerCase() +'.jpg';
      fs.writeFileSync(filePath, imageData);

      // Create the asset with the file path
      const asset = await client.stack(stack).asset().create({
          upload: filePath,
          title: sku.toLowerCase(),
          parent_uid: uidFolder
      }); 

      // Clean up the temporary file
      fs.unlinkSync(filePath); 

      return asset?.uid ?? '';
  } catch (error) {
    console.error('Error:', error);
  }
}