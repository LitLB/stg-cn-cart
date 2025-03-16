import { Cart } from '@commercetools/platform-sdk';
import { ICartStrategy } from '../interfaces/cart';

export class CartItemService<T extends ICartStrategy> {
    private cartStrategy: T

    constructor(strategy: new() => T,) {
        this.cartStrategy = new strategy()
    }

    private set accessToken(value: string) {
        this.cartStrategy.accessToken = value
    }

    public async addItem(accessToken: string, cart: Cart, payload: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.addItem(cart, payload)
    }

    public async updateItemQuantityById(accessToken: string, cart: Cart, body: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.updateItem(cart, body)
    }

    public async deleteItemById(accessToken: string, cart: Cart, body: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.removeItem(cart, body)
    }

    public async bulkDelete(accessToken: string, cart: Cart, body: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.bulkRemoveItems(cart, body)
    }

    public async select(accessToken: string, cart: Cart, body: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.selectItem(cart, body)
    }

    // protected async addItemDeviceBundleExisting(accessToken: string, cart: Cart, payload: any): Promise<any> {
    //     let updatedCart:any, bundledPackage:any
    //     const { package: mainPackage, productId, sku, quantity, productType, productGroup, addOnGroup, freeGiftGroup, campaignVerifyValues = [] } = payload;

    //     try {
    //         const now = new Date();
            
    //         const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

    //         const journey = cart.custom?.fields?.journey as CART_JOURNEYS;

    //         //TODO: create a method
    //         await InventoryValidator.validateLineItemUpsert(
    //             cart,
    //             sku,
    //             quantity,
    //             journey,
    //             payload.campaignVerifyValues && payload.campaignVerifyValues.length > 0
    //         );

    //         //TODO: create a method
    //         const product = await CommercetoolsProductClient.getProductById(productId);
    //         if (!product) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: 'Product not found',
    //             };
    //         }

    //         if (!product.masterData.published) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: 'Product is no longer available.',
    //             };
    //         }

    //         //TODO: create a method
    //         const variant = CommercetoolsProductClient.findVariantBySku(product, sku);
    //         if (!variant) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: 'SKU not found in the specified product',
    //             };
    //         }
    //         if (!variant.prices || variant.prices.length === 0) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: 'No prices found for this variant',
    //             };
    //         }
    //         if (!variant.attributes || variant.attributes.length === 0) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: 'No attributes found for this variant',
    //             };
    //         }

    //         //TODO: create a method
    //         const isValidReleaseDate = validateProductReleaseDate(variant.attributes, now)
    //         if (!isValidReleaseDate) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: 'Product release date is not in period',
    //             };
    //         }

    //         validateSkuStatus(variant.attributes)

    //         //TODO: create a method
    //         const validPrice = CommercetoolsProductClient.findValidPrice({
    //             prices: variant.prices,
    //             customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
    //             date: now,
    //         });
    //         if (!validPrice) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: 'No valid price found for the specified customer group and date range',
    //             };
    //         }

    //         validateByJourney(journey, payload, cart, variant)

    //         const deltaQuantity = quantity;
    //         validateProductQuantity(
    //             productType,
    //             cart,
    //             sku,
    //             product.id,
    //             variant,
    //             deltaQuantity,
    //         );


    //         //TODO: create a method
    //         bundledPackage = await CommercetoolsProductClient.queryProducts({
    //             where: `masterData(current(masterVariant(attributes(name="package_code")))) and masterData(current(masterVariant(attributes(value="${mainPackage.code}"))))`
    //         });
    //         if (bundledPackage.count !== 1) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: `Package not found or not available ${mainPackage.code}`,
    //             };
    //         } else {
    //             bundledPackage = bundledPackage.results[0]
    //         }

    //         //TODO: create a method
    //         const inventories = await CommercetoolsInventoryClient.getInventory(sku);
    //         if (inventories.length === 0) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.NOT_FOUND,
    //                 statusMessage: 'Inventory not found',
    //             };
    //         }

    //         //TODO: create a method
    //         const inventory = inventories[0];
    //         const { isDummyStock, isOutOfStock } = validateInventory(inventory)

    //         if (isOutOfStock && !isDummyStock) {
    //             throw {
    //                 statusCode: HTTP_STATUSES.BAD_REQUEST,
    //                 statusMessage: 'Insufficient stock for the requested quantity',
    //             };
    //         }

    //         //TODO: create a method
    //         const newProductGroup = this.calculateProductGroup({
    //             cart,
    //             productId,
    //             sku,
    //             productType,
    //             productGroup,
    //         })

    //         if (productType === 'insurance') {
    //             const validateInsuranceResult = await commercetoolsMeCartClient.validateInsurance(cart, {
    //                 productGroup: newProductGroup,
    //                 productId,
    //                 sku
    //             })

    //             if (!validateInsuranceResult?.isValid) {
    //                 return {
    //                     status: 'error',
    //                     message: validateInsuranceResult?.errorMessage
    //                 }
    //             }
    //         }

    //         //TODO: create a method
    //         const changes = [{
    //             sku,
    //             quantity,
    //             productType,
    //             productGroup: newProductGroup,
    //             addOnGroup,
    //             freeGiftGroup,
    //             campaignVerifyValues
    //         }]
    //         const action = 'add_product'
    //         const validateResult = await talonOneEffectConverter.validate(cart, changes, action)

    //         if (!validateResult?.isValid && (validateResult as any)?.isRequireCampaignVerify) {
    //             throw createStandardizedError({
    //                 statusCode: HTTP_STATUSES.BAD_REQUEST,
    //                 statusMessage: validateResult?.errorMessage,
    //                 errorCode: 'CAMPAIGN_VERIFY_KEY_IS_REQUIRED',
    //                 data: {
    //                     requestBody: {
    //                         ...payload
    //                     },
    //                     campaignVerifyKeys: (validateResult as any)?.campaignVerifyKeys,
    //                 }
    //             }, 'addItem');
    //         }

    //         if (!validateResult?.isValid) {
    //             throw createStandardizedError({
    //                 statusCode: HTTP_STATUSES.BAD_REQUEST,
    //                 statusMessage: validateResult?.errorMessage,
    //                 errorCode: (validateResult as any).errorCode
    //             }, 'addItem');
    //         }

    //         // TODO: filter out campaignVerifyValues that does not allow
    //         const allowCampaignVerifyKeys = (validateResult as { allowCampaignVerifyKeys?: any[] }).allowCampaignVerifyKeys ?? [];
    //         const { campaignVerifyKeys: allowCampaignVerifyKeysForCurrentItem = [] } = allowCampaignVerifyKeys.find((item: any) => item.sku === sku &&
    //             item.productType === productType &&
    //             item.productGroup === newProductGroup) || {}
            
    //         const filteredCampaignVerifyValues = campaignVerifyValues.filter((campaignVerifyValue: any) => {
    //             return allowCampaignVerifyKeysForCurrentItem.find((allowCampaignVerifyKey: any) => allowCampaignVerifyKey.name === campaignVerifyValue.name)
    //         })

    //         updatedCart = await CommercetoolsCartClient.updateCart(cart.id, cart.version, [
    //             {
    //                 action: 'addLineItem',
    //                 productId: productId,
    //                 variantId: variant.id,
    //                 quantity: quantity,
    //             },
    //             {
    //                 action: 'addLineItem',
    //                 productId: bundledPackage.id,
    //                 variantId: bundledPackage.masterData.current.masterVariant.id,
    //                 quantity: 1
    //             },
    //             {
    //                 action: 'addCustomLineItem',
    //                 name: { en: 'Advanced Payment' },
    //                 money: { currencyCode: 'THB', centAmount: mainPackage.advanced },
    //                 slug: 'advanced-payment',
    //                 quantity: 1,
    //                 taxCategory: {
    //                     typeId: 'tax-category',
    //                     id: 'fb18160d-f163-4d67-9e9c-f657653fdf25'
    //                 }
    //             }
    //         ])


    //         // updatedCart = await CommercetoolsCartClient.addItemToCart({
    //         //     cart,
    //         //     productId,
    //         //     variantId: variant.id,
    //         //     quantity,
    //         //     productType,
    //         //     productGroup: newProductGroup,
    //         //     addOnGroup,
    //         //     freeGiftGroup,
    //         //     externalPrice: validPrice.value,
    //         //     dummyFlag: isDummyStock,
    //         //     campaignVerifyValues: filteredCampaignVerifyValues,
    //         // });

    //         // const [result, error] = await this.addPackageToCart(updatedCart, bundledPackage)
    //         // if (error) {
    //         //     await CommercetoolsCartClient.emptyCart(result)

    //         //     throw {
    //         //         statusCode: HTTP_STATUSES.INTERNAL_SERVER_ERROR,
    //         //         statusMessage: 'Misconfigured bundled package',
    //         //     };
    //         // } else {
    //         //     updatedCart = result
    //         // }

    //         // if (mainPackage.advanced && mainPackage.advanced > 0) {
    //         //     const [result, error] = await this.addAdvancedToCart(updatedCart, mainPackage.advanced)

    //         //     if (error) {
    //         //         await CommercetoolsCartClient.emptyCart(result)
    
    //         //         throw {
    //         //             statusCode: HTTP_STATUSES.INTERNAL_SERVER_ERROR,
    //         //             statusMessage: 'Misconfigured bundled package',
    //         //         };
    //         //     } else {
    //         //         updatedCart = result
    //         //     }
    //         // }
            

    //         const ctCartWithChanged: Cart = await CommercetoolsProductClient.checkCartHasChanged(updatedCart)
    //         const { ctCart: cartWithUpdatedPrice, compared } = await CommercetoolsCartClient.updateCartWithNewValue(ctCartWithChanged)
    //         const updateCartWithOperator = await CommercetoolsCartClient.updateCartWithOperator(cartWithUpdatedPrice, payload.operator)
    //         const iCartWithBenefit = await commercetoolsMeCartClient.updateCartWithBenefit(updateCartWithOperator);

    //         return { ...iCartWithBenefit, hasChanged: compared };
    //     } catch (error: any) {
    //         console.log('error', JSON.stringify(error, null, 2));
            
    //         if (error.status && error.message) {
    //             throw error;
    //         }

    //         throw createStandardizedError(error, 'addItem');
    //     }
    // }
}
