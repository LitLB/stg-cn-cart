import { Cart, CustomObject, LineItem, MyCartUpdateAction, Product, ProductVariant } from "@commercetools/platform-sdk";
import { CommercetoolsCartClient } from "../adapters/ct-cart-client";
import { CommercetoolsInventoryClient } from "../adapters/ct-inventory-client";
import { CommercetoolsProductClient } from "../adapters/ct-product-client";
import CommercetoolsMeCartClient from "../adapters/me/ct-me-cart-client";
import { BaseCartStrategy } from "./base-cart.strategy";
import { createStandardizedError } from "../utils/error.utils";
import { InventoryValidator } from "../validators/inventory.validator";
import { CART_JOURNEYS } from "../constants/cart.constant";
import { HTTP_STATUSES } from "../constants/http.constant";
import { validateDeleteCartItemBody, validateProductQuantity, validateProductReleaseDate, validateSelectCartItemBody, validateSkuStatus, validateUpdateCartItemBody } from "../schemas/cart-item.schema";
import { readConfiguration } from "../utils/config.utils";
import { validateInventory } from "../utils/cart.utils";
import { LINE_ITEM_INVENTORY_MODES } from "../constants/lineItem.constant";
import { CommercetoolsCustomObjectClient } from "../adapters/ct-custom-object-client";
import { ICart } from "../interfaces/cart";
import _ from 'lodash'

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
        const cartQuantity = this.getItemQuantityBySku(cart, sku)

        // Add
        if (cartQuantity === 1 && deltaQuantity > 0) {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Cannot have more than 1 unit of SKU ${sku} in the cart.`,
            };
        }

        validateProductQuantity(
            productType,
            cart,
            sku,
            product.id,
            variant,
            deltaQuantity,
        );
        
    }

    protected getItemQuantityBySku(cart: Cart, sku: string) {
        return cart.lineItems.filter((item: LineItem) => item.variant.sku === sku).reduce((sum, item) => sum + item.quantity, 0);
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
    
    protected validateDeviceBundleExisting(body:any, cart: Cart, variant: ProductVariant) {
        const { package: mainPackage, sku } = body
    
        const mainProductLineItems = cart.lineItems.filter(
            (item: LineItem) => item.custom?.fields?.productType === 'main_product',
        );
    
        const totalCartQuantity = mainProductLineItems.reduce((sum, item) => sum + item.quantity, 0);
    
        if (_.isEmpty(mainPackage)) {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: '"package.code" is required for journey "device_bundle_existing"',
            };
        }
    
        if (totalCartQuantity > 1) {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Cannot have more than 1 unit of SKU ${sku} in the cart.`,
            };
        }
    
        if (!variant.attributes?.some((value) => value.name === 'journey' && value.value.some((journey: any) => journey.key === CART_JOURNEYS.DEVICE_BUNDLE_EXISTING))) {
            throw {
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: `Cannot add a non-"device_bundle_existing" item to a "device_bundle_existing" cart.`,
            };
        }
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
            const { package: packageInfo, productId, sku, quantity, productType, productGroup } = payload;
            const journey = cart.custom?.fields?.journey as CART_JOURNEYS;

            await InventoryValidator.validateLineItemUpsert(
                cart,
                sku,
                quantity,
                journey,
                payload.campaignVerifyValues && payload.campaignVerifyValues.length > 0
            );

            const product = await this.getProductById(productId)
            const variant = this.getVariantBySku(product, sku)
            this.validateDeviceBundleExisting(payload, cart, variant)
            const validPrice = this.getValidPrice(variant, now)
            const mainPackage = await this.getPackageByCode(packageInfo.code)
            const { advancedPayment, contractTerm, contractFee } = await this.getPackageAdditionalInfo(packageInfo.code)

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
                    externalPrice: validPrice.value,
                    custom: {
                        type: {
                            typeId: 'type',
                            key: 'lineItemCustomType',
                        },
                        fields: {
                            productType,
                            productGroup,
                            selected: false,
                            isPreOrder: false,
                        },
                    },
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
                    },
                    custom: {
                        type: {
                            typeId: 'type',
                            key: 'lineItemCustomType',
                        },
                        fields: {
                            selected: false,
                        },
                    },
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
                    action: "setCustomField",
                    name: "advancedPayment",
                    value: advancedPayment
                },
                {
                    action: "setCustomField",
                    name: "contractTerm",
                    value: contractTerm
                },
                {
                    action: "setCustomField",
                    name: "contractFee",
                    value: contractFee
                },
            ]);
            let iCart: ICart = this.adapters.commercetoolsMeCartClient.mapCartToICart(updatedCart);
            // const ctCartWithChanged: Cart = await this.adapters.commercetoolsProductClient.checkCartHasChanged(updatedCart)
            // const { ctCart: cartWithUpdatedPrice, compared } = await this.adapters.commercetoolsCartClient.updateCartWithNewValue(ctCartWithChanged)
            // const updateCartWithOperator = await this.adapters.commercetoolsCartClient.updateCartWithOperator(cartWithUpdatedPrice, payload.operator)
            // const iCartWithBenefit = await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(updateCartWithOperator);

            return iCart;
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'addItem');
        }
    }

    public async removeItem(cart: Cart, body: any): Promise<any> {
        try {
            const { error, value } = validateDeleteCartItemBody(body);
            if (error) {
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const { productId, sku, productGroup, productType, addOnGroup, freeGiftGroup } = value;

            const product = await this.adapters.commercetoolsProductClient.getProductById(productId);
            if (!product) {
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'Product not found',
                };
            }

            const variant = this.adapters.commercetoolsProductClient.findVariantBySku(product, sku);
            if (!variant) {
                throw {
                    statusCode: HTTP_STATUSES.NOT_FOUND,
                    statusMessage: 'SKU not found in the specified product',
                };
            }

            let updatedCart = await this.adapters.commercetoolsCartClient.emptyCart(cart)

            // const customerSession = await this.adapters.talonOneIntegrationAdapter.getCustomerSession(updatedCart.id);

            // if (updatedCart.lineItems.length === 0) {
            //     updatedCart = await this.couponService.clearAllCoupons(updatedCart, customerSession);
            // }

            // updatedCart = await this.adapters.commercetoolsMeCartClient.resetCartItemProductGroup(updatedCart)

            // let iCartWithBenefit = await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(updatedCart);
            // iCartWithBenefit = updateCartFlag(iCartWithBenefit)

            return this.adapters.commercetoolsMeCartClient.mapCartToICart(updatedCart);
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'removeItem');
        }
    }

    public async updateItem(cart: Cart, body: any): Promise<any> {
        try {
            const { error, value } = validateUpdateCartItemBody(body);

            if (error) {
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const now = new Date();
            const { package: packageInfo, productId, sku, quantity, productType } = value;

            const journey = cart.custom?.fields?.journey as CART_JOURNEYS;

            if (!packageInfo) {
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: `"package" field is missing for the cart journey ${journey}`,
                };
            }

            await InventoryValidator.validateLineItemReplaceQty(cart, sku, quantity, journey);

            const product = await this.getProductById(productId)
            const variant = this.getVariantBySku(product, sku)
    
            this.validateReleaseDate(variant.attributes!, now)
            this.validateStatus(variant)
            const cartQuantity = this.getItemQuantityBySku(cart, sku)
            const deltaQuantity = quantity - cartQuantity
            
            if (deltaQuantity > 0) {
                this.validateQuantity(productType, cart, sku, product, variant, deltaQuantity)
            }
            
            let iCart: ICart = this.adapters.commercetoolsMeCartClient.mapCartToICart(cart);
            // const ctCartWithChanged: Cart = await this.adapters.commercetoolsProductClient.checkCartHasChanged(updatedCart)
            // const { ctCart: cartWithUpdatedPrice, compared } = await this.adapters.commercetoolsCartClient.updateCartWithNewValue(ctCartWithChanged)
            // const updateCartWithOperator = await this.adapters.commercetoolsCartClient.updateCartWithOperator(cartWithUpdatedPrice, payload.operator)
            // const iCartWithBenefit = await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(updateCartWithOperator);

            return iCart;
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'updateItem');
        }
    }

    public async selectItem(cart: Cart, body: any): Promise<any> {
        try {
            const { value, error } = validateSelectCartItemBody(body);
            if (error) {
                throw {
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const { items } = value;

            const updateActions: MyCartUpdateAction[] = [];

            for (const item of items) {
                const { package: packageInfo, sku, productType, productGroup, selected } = item;

                if (!packageInfo) {
                    throw {
                        statusCode: HTTP_STATUSES.BAD_REQUEST,
                        statusMessage: 'Validation failed',
                        data: '"package" field is missing',
                    };
                }

                const lineItem = cart.lineItems.find((lineItem: any) => {
                    return lineItem.variant.sku === sku
                        // && lineItem.custom?.fields?.productGroup == productGroup
                        && lineItem.custom?.fields?.productType === productType
                });
                const packageItem = cart.lineItems.find((lineItem: any) => {
                    return lineItem.variant.attributes.some((attribute:any) => attribute.name === 'package_code'
                            && attribute.value === packageInfo.code)
                });

                if (!lineItem) {
                    throw {
                        statusCode: HTTP_STATUSES.NOT_FOUND,
                        statusMessage: `Line item with SKU ${sku} not found in the cart.`,
                    };
                }
                if (!packageItem) {
                    throw {
                        statusCode: HTTP_STATUSES.NOT_FOUND,
                        statusMessage: `Line item with SKU ${sku} not found in the cart.`,
                    };
                }

                updateActions.push({
                    action: 'setLineItemCustomField',
                    lineItemId: lineItem.id,
                    name: 'selected',
                    value: selected,
                });

                updateActions.push({
                    action: 'setLineItemCustomField',
                    lineItemId: packageItem.id,
                    name: 'selected',
                    value: selected,
                });
            }

            const updatedCart = await this.adapters.commercetoolsMeCartClient.updateCart(
                cart.id,
                cart.version,
                updateActions,
            );

            // const ctCartWithChanged: Cart = await this.adapters.commercetoolsProductClient.checkCartHasChanged(updatedCart)
            // const { ctCart: cartWithUpdatedPrice, compared } = await this.adapters.commercetoolsCartClient.updateCartWithNewValue(ctCartWithChanged)
            // const iCartWithBenefit = await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(cartWithUpdatedPrice);

            return this.adapters.commercetoolsMeCartClient.mapCartToICart(updatedCart);
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'select');
        }
    }
}