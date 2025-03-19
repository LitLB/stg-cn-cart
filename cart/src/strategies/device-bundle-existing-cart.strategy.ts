import { Cart, CustomObject, Product, ProductVariant } from "@commercetools/platform-sdk";
import { CommercetoolsCartClient } from "../adapters/ct-cart-client";
import { CommercetoolsInventoryClient } from "../adapters/ct-inventory-client";
import { CommercetoolsProductClient } from "../adapters/ct-product-client";
import CommercetoolsMeCartClient from "../adapters/me/ct-me-cart-client";
import { BaseCartStrategy } from "./base-cart.strategy";
import { createStandardizedError } from "../utils/error.utils";
import { InventoryValidator } from "../validators/inventory.validator";
import { CART_JOURNEYS } from "../constants/cart.constant";
import { HTTP_STATUSES } from "../constants/http.constant";
import { validateProductQuantity, validateProductReleaseDate, validateSkuStatus } from "../schemas/cart-item.schema";
import { readConfiguration } from "../utils/config.utils";
import { validateInventory } from "../utils/cart.utils";
import { LINE_ITEM_INVENTORY_MODES } from "../constants/lineItem.constant";
import { CommercetoolsCustomObjectClient } from "../adapters/ct-custom-object-client";

export class DeviceBundleExistingCartStrategy extends BaseCartStrategy {
    constructor() {
        super(
            CommercetoolsProductClient, 
            CommercetoolsCartClient, 
            CommercetoolsInventoryClient, 
            CommercetoolsCustomObjectClient,
            // TalonOneEffectConverter,
            // TalonOneIntegrationAdapter
        )
    }
    
    set accessToken(value: string) {
        const adapter = new CommercetoolsMeCartClient(value)
        this.adapters[adapter.name] = adapter
    }

    protected async getProductById(id: string): Promise<Product> {
        const product = await this.adapters.commercetoolsProductClient.getProductById(id);
        if (!product) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'Product not found',
            };
        }

        if (!product.masterData.published) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'Product is no longer available.',
            };
        }

        return product
    }

    protected async getPackageByCode(code: string): Promise<Product> {
        const mainPackage = await this.adapters.commercetoolsProductClient.queryProducts({
            where: `masterData(current(masterVariant(attributes(name="package_code")))) and masterData(current(masterVariant(attributes(value="${code}"))))`
        })

        if (!mainPackage.results.length) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'Package not found',
            };
        }

        if (!mainPackage.results[0].masterData.published) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'Package is no longer available.',
            };
        }

        return mainPackage.results[0]
    }

    protected getVariantBySku(product: Product, sku: string): ProductVariant {
        const variant = this.adapters.commercetoolsProductClient.findVariantBySku(product, sku);

        if (!variant) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'SKU not found in the specified product',
            };
        }
        if (!variant.prices || variant.prices.length === 0) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'No prices found for this variant',
            };
        }

        if (!variant.attributes || variant.attributes.length === 0) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'No attributes found for this variant',
            };
        }

        return variant
    }

    protected validateReleaseDate(attributes: any[], today: Date) {
        const isValidReleaseDate = validateProductReleaseDate(attributes, today)

        if (!isValidReleaseDate) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'Product release date is not in period',
            };
        }
    }

    protected validateStatus(variant: ProductVariant):void {
        validateSkuStatus(variant.attributes!)
    }

    protected getValidPrice(variant: ProductVariant, today: Date) {
        const validPrice = this.adapters.commercetoolsProductClient.findValidPrice({
            prices: variant.prices,
            customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
            date: today,
        });

        if (!validPrice) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'No valid price found for the specified customer group and date range',
            };
        }

        return validPrice
    }

    protected validateQuantity(productType: string, cart: Cart, sku: string, product: Product, variant: ProductVariant, deltaQuantity: number) {
        validateProductQuantity(
            productType,
            cart,
            sku,
            product.id,
            variant,
            deltaQuantity,
        );
    }

    protected async getInventories(skus: string) {
        const inventories = await this.adapters.commercetoolsInventoryClient.getInventory(skus);
        if (inventories.length === 0) {
            throw {
                statusCode: HTTP_STATUSES.NOT_FOUND,
                statusMessage: 'Inventory not found',
            };
        }

        return inventories
    }

    protected validateInventory(inventory: any): any {
        const { isDummyStock, isOutOfStock } = validateInventory(inventory)

        if (isOutOfStock && !isDummyStock) {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'Insufficient stock for the requested quantity',
            };
        }

        return { isDummyStock, isOutOfStock }
    }

    protected async getPackageAdditionalInfo(code: string): Promise<any> {
        const packageInfo = {
            advancedPayment: {
                currencyCode: "THB",
                centAmount: 42000
            },
            contractTerm: "12",
            contractFee:{
                currencyCode: "THB",
                centAmount: 1_000_000
            },
        }

        return packageInfo
    }

    private calculateProductGroup = ({
        cart,
        productId,
        sku,
        productType,
        productGroup,
    }: {
        cart: any;
        productId: any;
        sku: any;
        productType: any;
        productGroup: number;
    }) => {
        // TODO: Free Gift changes
        if (['add_on', 'insurance', 'free_gift'].includes(productType)) {
            return productGroup;
        }

        const { lineItems } = cart;

        const existing = lineItems.find((lineItem: any) => {
            return (
                productId === lineItem.productId &&
                sku === lineItem.variant.sku &&
                productType === lineItem.custom?.fields?.productType
            );
        });

        if (existing) {
            return existing.custom?.fields?.productGroup;
        }

        // new
        const mainProducts = lineItems.filter(
            (lineItem: any) => lineItem.custom?.fields?.productType === 'main_product'
        );

        const newProductGroup = mainProducts.length + 1;

        return newProductGroup;
    };
    
    public async addItem(cart: Cart, payload: any): Promise<any> {
        try {
            const now = new Date();
            const { package: packageInfo, productId, sku, quantity, productType, productGroup, addOnGroup, freeGiftGroup, campaignVerifyValues = [] } = payload;

            const journey = cart.custom?.fields?.journey as CART_JOURNEYS;

            await InventoryValidator.validateLineItemUpsert(
                cart,
                sku,
                quantity,
                journey,
                payload.campaignVerifyValues && payload.campaignVerifyValues.length > 0
            );

            const product = await this.getProductById(productId)
            const mainPackage = await this.getPackageByCode(packageInfo.code)
            const packageAdditionalInfo = await this.getPackageAdditionalInfo(packageInfo.code)
            const variant = this.getVariantBySku(product, sku)
            const validPrice = this.getValidPrice(variant, now)

            this.validateReleaseDate(variant.attributes!, now)
            this.validateStatus(variant)
            this.validateQuantity(productType, cart, sku, product, variant, quantity)

            const inventories = await this.getInventories(sku)
            const inventory = inventories[0];

            const { isDummyStock } = this.validateInventory(inventory)

            const newProductGroup = this.calculateProductGroup({
                cart,
                productId,
                sku,
                productType,
                productGroup,
            })


            /**
            if (productType === 'insurance') {
                const validateInsuranceResult = await this.adapters.commercetoolsMeCartClient.validateInsurance(cart, {
                    productGroup: newProductGroup,
                    productId,
                    sku
                })

                if (!validateInsuranceResult?.isValid) {
                    return {
                        status: 'error',
                        message: validateInsuranceResult?.errorMessage
                    }
                }
            }

            const changes = [{
                sku,
                quantity,
                productType,
                productGroup: newProductGroup,
                addOnGroup,
                freeGiftGroup,
                campaignVerifyValues
            }]
            const action = 'add_product'
            const validateResult = await this.adapters.talonOneEffectConverter.validate(cart, changes, action)

            if (!validateResult?.isValid && (validateResult as any)?.isRequireCampaignVerify) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: validateResult?.errorMessage,
                    errorCode: 'CAMPAIGN_VERIFY_KEY_IS_REQUIRED',
                    data: {
                        requestBody: {
                            ...payload
                        },
                        campaignVerifyKeys: (validateResult as any)?.campaignVerifyKeys,
                    }
                }, 'addItem');
            }

            if (!validateResult?.isValid) {
                throw createStandardizedError({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: validateResult?.errorMessage,
                    errorCode: (validateResult as any).errorCode
                }, 'addItem');
            }
            

            // TODO: filter out campaignVerifyValues that does not allow
            const allowCampaignVerifyKeys = (validateResult as { allowCampaignVerifyKeys?: any[] }).allowCampaignVerifyKeys ?? [];
            const { campaignVerifyKeys: allowCampaignVerifyKeysForCurrentItem = [] } = allowCampaignVerifyKeys.find((item: any) => item.sku === sku &&
                item.productType === productType &&
                item.productGroup === newProductGroup) || {}
            
            const filteredCampaignVerifyValues = campaignVerifyValues.filter((campaignVerifyValue: any) => {
                return allowCampaignVerifyKeysForCurrentItem.find((allowCampaignVerifyKey: any) => allowCampaignVerifyKey.name === campaignVerifyValue.name)
            })
            

            const updatedCart = await this.adapters.commercetoolsCartClient.addItemToCart({
                cart,
                productId,
                variantId: variant.id,
                quantity,
                productType,
                productGroup: newProductGroup,
                addOnGroup,
                freeGiftGroup,
                externalPrice: validPrice.value,
                dummyFlag: isDummyStock,
                campaignVerifyValues: filteredCampaignVerifyValues,
            });
            */


            const updatedCart = await this.adapters.commercetoolsCartClient.updateCart(cart.id, cart.version, [
                {
                    action: "addLineItem",
                    productId: product.id,
                    variantId: variant.id,
                    quantity: quantity,
                    supplyChannel: {
                        typeId: 'channel',
                        id: readConfiguration().ctpSupplyChannel,
                    },
                    inventoryMode: LINE_ITEM_INVENTORY_MODES.RESERVE_ON_ORDER,
                    externalPrice: validPrice.value
                },
                {
                    action: "addLineItem",
                    productId: mainPackage.id,
                    variantId: mainPackage.masterData.current.masterVariant.id,
                    quantity: 1,
                    inventoryMode: LINE_ITEM_INVENTORY_MODES.NONE,
                    externalPrice: {
                        currencyCode: "THB",
                        centAmount: 0
                    }
                },
                {
                    action: "addCustomLineItem",
                    name: {
                        "en-US": "Advanced Payment",
                        "th-TH": "ค่าบริการล่วงหน้า"
                    },
                    quantity: 1,
                    money: {
                        currencyCode: "THB",
                        centAmount: 420000
                    },
                    slug: "advance-payment",
                    taxCategory: {
                        typeId: "tax-category",
                        id: readConfiguration().ctpTaxCategoryId
                    }
                },
                {
                    action: "setCustomType",
                    type: { "key": "packageAdditionalInfo" },
                    fields: packageAdditionalInfo
                },
            ]);

            // const ctCartWithChanged: Cart = await this.adapters.commercetoolsProductClient.checkCartHasChanged(updatedCart)
            // const { ctCart: cartWithUpdatedPrice, compared } = await this.adapters.commercetoolsCartClient.updateCartWithNewValue(ctCartWithChanged)
            // const updateCartWithOperator = await this.adapters.commercetoolsCartClient.updateCartWithOperator(cartWithUpdatedPrice, payload.operator)
            // const iCartWithBenefit = await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(updateCartWithOperator);

            return updatedCart;
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'addItem');
        }
    }
}