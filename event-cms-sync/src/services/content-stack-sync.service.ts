import { createApiRoot } from '../client/create.client.js';
import { logger } from '../utils/logger.utils';
import { 
  publish,
  getAsset,
  unPublish,
  uploadImage,
  createEntry,
  updateEntry,
  deleteEntry,
  getTaxonomy,
  createFolder,
  getFolderAsset,
  createTaxonomy,
  getTermsOfTaxonomy,
  createTermsOfTaxonomy,
  getContentStackCampaignEntry,
  getContentStackAllCampaignEntry
} from '../services/content-stack.service';


export class cmsServices {

  async isServiceType(productID: string) {
    const product = await this.getCommerceToolsProduct(productID, 'productType.id');
    const productType = product.data?.productType?.obj?.key;

    if (productType?.trim()?.toLowerCase() === 'service') {
      return true;
    }
    return false;
  }

  async resourceCreated(productID: string) {
    const product = await this.getCommerceToolsProduct(productID);
    const productStaged = product.data.masterData.staged; 
    const entry = await getContentStackCampaignEntry(productID);

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
    const entries = await getContentStackAllCampaignEntry(productID);
  
    if (isPublished && !hasStagedChanges) {
      await publish(entries);
      return;
    }
  
    if (!isPublished && !hasStagedChanges) {
      await unPublish(entries);
      return;
    }
  
    if (entries.length === 0) {
      await this.resourceCreated(productID);
      return;
    }

    const payload = await this.mappingData(entries, productID, productStaged);

    await updateEntry(entries, payload);
    return;
  }

  async resourceDeleted(productID: string) {
    const entries = await getContentStackAllCampaignEntry(productID);

    if (entries.length === 0) {
      return 'Nothing to do.';
    }

    await deleteEntry(entries);
    return;
  }

  async getCommerceToolsProduct(productID: string, expand: string = '') { 

    let query: any = {
      queryArgs: {
        where: `id = "${productID}"`,
        expand: [
          `masterData.staged.categories[*]`,
          `masterData.staged.categories[*].parent.id`,
        ]
      }
    };
    
    if (expand) {
      query.queryArgs.expand.push(expand);
    }

    const response = await createApiRoot()
      .products()
      .get(query)
      .execute();

    return {
      id: response.body.results[0]?.id,
      data: response.body.results[0],
    };
  }

  async mappingData(oldData: any[], productID: string, newData: any) {
    const masterVariant = newData.masterVariant;
    const variants = newData.variants;
    const commerceToolsData = [masterVariant, ...variants];
    const contentStackData = oldData?.[0]?.variant_images ?? [];
    const productNameTH = newData?.name?.['th-TH'] ?? ''; // Default language
    const productNameUS = newData?.name?.['en-US'] ?? ''; 
    const brandName = masterVariant.attributes.find((attr: { name: string }) => attr?.name === 'brand_name');
    const objCategory = newData?.categories?.[0]?.obj;
    const imageUrl = masterVariant.attributes.find((attr: { name: string }) => attr?.name === 'image');
    const uidProductImage = imageUrl?.value ? imageUrl?.value.split('/')[6] : '';

    let mainCategory = objCategory?.parent?.obj?.name?.['en-US'] ?? objCategory?.parent?.obj?.name?.['th-TH'] ?? 'category';
    let subCategory = objCategory?.name?.['en-US'] ?? objCategory?.name?.['th-TH'] ?? 'sub-category';
    const mainCategorySlug = mainCategory?.toLowerCase().replace(/\s+/g, "-");
    const subCategorySlug = subCategory?.toLowerCase().replace(/\s+/g, "-");

    let newResult = [...contentStackData]; // Deep copy for manipulation
    let uidFolder = '';

    uidFolder = await getFolderAsset(productID);
    if (!uidFolder) {
      uidFolder = await createFolder(productID);
    }

    // Find updates and deletions of variant
    const images: { sku: string; uid: string }[] = [];
    for (const [index, oldItem] of newResult.entries()) {
      
      const newItem = commerceToolsData.find(item => item.sku === oldItem.image_color.sku);
      // Delete
      if (!newItem) { 
        newResult.splice(index);
        continue;
      }

      let uidMainVariantImage = '';
      if (newItem?.images[0]?.url) {
        const existingImage = images.find(image => image.sku === newItem.sku);

        if (!existingImage) {
          uidMainVariantImage = await uploadImage(uidFolder, newItem.images[0].url, newItem.sku);
          images.push({ sku: newItem.sku, uid: uidMainVariantImage });
        } else {
          uidMainVariantImage = existingImage.uid;
        }
      }

      const colorAttribute = newItem.attributes.find((attr: { name: string }) => attr?.name === 'color');
      const statusAttribute = newItem.attributes.find((attr: { name: string }) => attr?.name === 'status');

      // Update images
      newResult[index].image_color.main_image = uidMainVariantImage;
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
    }

    // Find creations variant
    for (const newItem of commerceToolsData) {
      const oldItem = newResult.find(item => item?.image_color?.sku === newItem.sku);
      if (!oldItem) {
        const colorAttribute = newItem.attributes.find((attr: { name: string }) => attr?.name === 'color');
        const statusAttribute = newItem.attributes.find((attr: { name: string }) => attr?.name === 'status');
  
        const color = colorAttribute?.value?.label ?? '';
        const status = statusAttribute?.value?.label.toLowerCase() === 'enabled';

        const imageColor = {
          sku: newItem.sku,
          status: status,
          color: color
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

    return {
      'th-th': {
        product_name: productNameTH,
        main_category: mainCategorySlug,
        sub_category: subCategorySlug,
        brand_name: brandName?.value?.label.toLowerCase() ?? '',
        main_image_group: {
          main_image: uidProductImage,
        },
        variant_images: newResult
      },
      'en-us': {
        product_name: productNameUS,
        main_category: mainCategorySlug,
        sub_category: subCategorySlug,
        brand_name: brandName?.value?.label.toLowerCase() ?? '',
        main_image_group: { 
          main_image: uidProductImage,
        },
        variant_images: newResult
      },
    };
  }
  
  async buildData(id: string, product: any) {
    const { 
      masterVariant,
      variants,
      name,
      slug,
      description
    } = product;
    const commerceToolsData = [masterVariant, ...variants];
    let variantImages: any[] = [];
    const taxonomyUID = 'campaign_group';
    const termUID = 'mass';

    const productSlug = slug?.['th-TH'] ?? slug?.['en-US'] ?? '';
    const productName = name?.['th-TH'] ?? name?.['en-US'] ?? '';
    const shortDescription = masterVariant.attributes.find((attr: { name: string }) => attr?.name === 'short_description');
    const brandName = masterVariant.attributes.find((attr: { name: string }) => attr?.name === 'brand_name');
    const productId = masterVariant.attributes.find((attr: { name: string }) => attr?.name === 'product_id');
    const objCategory = product?.categories?.[0]?.obj;
    let mainCategory = objCategory?.parent?.obj?.name?.['en-US'] ?? objCategory?.parent?.obj?.name?.['th-TH'] ?? 'category';
    let subCategory = objCategory?.name?.['en-US'] ?? objCategory?.name?.['th-TH'] ?? 'sub-category';
    const mainCategorySlug = mainCategory?.toLowerCase().replace(/\s+/g, "-");
    const subCategorySlug = subCategory?.toLowerCase().replace(/\s+/g, "-");

    if (!productName) {
      logger.info(`Data: ${JSON.stringify(product)}`);
      throw new Error('Product name is not available.');
    }
  
    for (const item of commerceToolsData) {
      const statusAttribute = item.attributes.find((attr: any) => attr?.name === 'status');
      const colorAttribute = item.attributes.find((attr: any) => attr?.name === 'color');
      
      const status = statusAttribute?.value?.label.toLowerCase() === 'enabled';
      const color = colorAttribute?.value?.label ?? '';
  
      const taxonomy = await getTaxonomy(taxonomyUID);
      if (!taxonomy) {
        await createTaxonomy(taxonomyUID);
        await createTermsOfTaxonomy(taxonomyUID, termUID);
      }
       
      const channels = await getTermsOfTaxonomy('display_channel');

      channels.forEach((channel: string) => {
        variantImages.push({
          image_color: {
            status: status,
            sku: item?.sku ?? '',
            color: color,
            display_channel: channel,
            images: [],
          },
        });
      });
    }

    return {
      title: productName,
      product_name: productName,
      url: `/${mainCategorySlug}/${subCategorySlug}/${productSlug}`,
      commerce_tools_id: id,
      product_id: productId?.value ?? '',
      main_category: mainCategorySlug,
      sub_category: subCategorySlug,
      campaign_group: termUID,
      brand_name: brandName?.value?.label.toLowerCase() ?? '',
      variant_images: variantImages,
      product_short_description: shortDescription?.value?.['th-TH'] ?? '',
      description: [{
              tab: {
                  name: "ภาพรวม",
                  description: description?.["th-TH"] ?? '',
              }
          }]
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