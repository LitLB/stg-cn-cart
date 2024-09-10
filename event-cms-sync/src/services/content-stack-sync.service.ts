import { createApiRoot } from '../client/create.client.js';
import { logger } from '../utils/logger.utils';
import { 
  publish,
  unPublish,
  createEntry,
  updateEntry,
  deleteEntry,
  getTermsOfTaxonomy,
  getContentStackEntry
} from '../services/content-stack.service';

// TODO : main image

export class cmsServices {
  async resourceCreated(productID: string) {
    const product = await this.getCommerceToolsProduct(productID);
    const productStaged = product.data.masterData.staged; 
    const entry = await getContentStackEntry(productID);

    if (entry.length === 0) {
      const payload = await this.buildData(productID, productStaged);
      await createEntry(payload);
      return;
    } else {
      await this.resourceUpdated(productID, product);
      return;
    }
  }

  async resourceUpdated(productID: string, product: any = {}) {

    if (Object.keys(product).length === 0) {
      product = await this.getCommerceToolsProduct(productID);
    }
  
    const productStaged = product.data.masterData.staged;
    const isPublished = product.data.masterData.published;
    const hasStagedChanges = product.data.masterData.hasStagedChanges;
    const entry = await getContentStackEntry(productID);
    const entryUID = entry[0]?.uid;

    if (isPublished && !hasStagedChanges) {
      await publish(entryUID);
      return;
    }
  
    if (!isPublished && !hasStagedChanges) {
      await unPublish(entryUID);
      return;
    }
  
    if (entry.length === 0) {
      await this.resourceCreated(productID);
      return;
    }

    const payload = await this.mappingData(entry, productStaged);

    await updateEntry(entryUID, payload);
    return;
  }

  async resourceDeleted(productID: string) {
    const entry = await getContentStackEntry(productID);
  
    if (entry.length === 0) {
      return 'Nothing to do.';
    }
  
    const entryUID = entry[0]?.uid 
    await deleteEntry(entryUID);
    return;
  }

  async getCommerceToolsProduct(productID: string) {
    const response = await createApiRoot()
      .products()
      .get({
        queryArgs: {
          where: `id = "${productID}"`,
        },
      })
      .execute();
  
    return {
      id: response.body.results[0]?.id,
      data: response.body.results[0],
    };
  }

  async mappingData(oldData: any[], newData: any) {
    const masterVariant = newData.masterVariant;
    const variants = newData.variants;
    const commerceToolsData = [masterVariant, ...variants];
    const contentStackData = oldData[0]?.variant_images || [];
    
    let newResult = [...contentStackData]; // Deep copy for manipulation

    // Find updates and deletions
    newResult = newResult.filter((oldItem, index) => {
      const newItem = commerceToolsData.find(item => item.sku === oldItem.image_color.sku);
      if (!newItem) return false; // Delete
  
      const colorAttribute = newItem.attributes.find((attr: { name: string }) => attr.name === 'color'); 
      const statusAttribute = newItem.attributes.find((attr: { name: string }) => attr.name === 'status');
  
      // Update images
      oldItem.image_color.images?.forEach((item: { uid: string }, idx: number) => {
        newResult[index].image_color.images[idx] = item.uid;
      });
  
      // Update color
      if (colorAttribute) {
        newResult[index].image_color.color = colorAttribute.value.label;
      }
  
      // Update status
      if (statusAttribute) {
        newResult[index].image_color.status = statusAttribute.value.label.toLowerCase() === 'enabled';
      }
  
      return true; // Keep the item
    });

    // Find creations
    for (const newItem of commerceToolsData) {
      const oldItem = newResult.find(item => item?.image_color?.sku === newItem.sku);
      if (!oldItem) {
        const colorAttribute = newItem.attributes.find((attr: { name: string }) => attr.name === 'color');
        const statusAttribute = newItem.attributes.find((attr: { name: string }) => attr.name === 'status');
  
        const color = colorAttribute?.value?.label || '';
        const status = statusAttribute?.value?.label.toLowerCase() === 'enabled';
  
        const imageColor = {
          sku: newItem.sku,
          status: status,
          color: color,
          images: []
        };

        const channels = await getTermsOfTaxonomy('display_channel');
        channels.forEach((channel: string) => {
          newResult.push({
            image_color: {
              ...imageColor,
              display_channel: channel
            }
          });
        });
      }
    }

    const productName = newData.name['th-TH'] ?? newData.name['en-US'] ?? '';
    if (!productName) {
      logger.info(`Data: ${JSON.stringify(newData)}`);
      throw new Error('Product name is not available.');
    }

    return {
      product_name: productName,
      variant_images: newResult
    };
  }
  
  async buildData(id: string, product: any) {
    const { masterVariant, variants, name, slug } = product;
    const commerceToolsData = [masterVariant, ...variants];
    let variantImages: any[] = [];
  
    for (const item of commerceToolsData) {
      const statusAttribute = item.attributes.find((attr: any) => attr.name === 'status');
      const colorAttribute = item.attributes.find((attr: any) => attr.name === 'color');
      
      const status = statusAttribute?.value?.label.toLowerCase() === 'enabled';
      const color = colorAttribute?.value?.label || '';
  
      const channels = await getTermsOfTaxonomy('display_channel');
  
      channels.forEach((channel: string) => {
        variantImages.push({
          image_color: {
            status: status,
            sku: item.sku,
            color: color,
            display_channel: channel,
            images: [],
          },
        });
      });
    }
  
    const slugUrl = slug['en-US'] ?? slug['th-TH'] ?? '';
    const productName = name['th-TH'] ?? name['en-US'] ?? '';

    if (!productName) {
      logger.info(`Data: ${JSON.stringify(product)}`);
      throw new Error('Product name is not available.');
    }

    return {
        title: productName,
        product_name: productName,
        url: `/${slugUrl}`, // TODO :: catogory
        commerce_tools_id: id,
        taxonomies: [{
          taxonomy_uid: "campaign_group",
          term_uid: "mass"
        }],
        variant_images: variantImages,
    };
  }
  
  async decodedData(request: any) {
    const decodedData = request.body.message.data
      ? Buffer.from(request.body.message.data, 'base64').toString().trim()
      : undefined;
  
    return decodedData ? JSON.parse(decodedData) : {};
  }
}

export const cmsService = new cmsServices();