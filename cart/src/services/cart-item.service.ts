// cart/src/services/cart-item.service.ts

import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { validateAddItemCartBody, validateBulkDeleteCartItemBody, validateDeleteCartItemBody, validateProductQuantity, validateSelectCartItemBody, validateUpdateCartItemBody } from '../validators/cart-item.validator';
import { talonOneEffectConverter } from '../adapters/talon-one-effect-converter';
import { readConfiguration } from '../utils/config.utils';
import { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { createStandardizedError } from '../utils/error.utils';

export class CartItemService {
    // private getJourneyDeviceOnly = (variant: any): string | undefined => {
    //     const journeyAttribute = variant.attributes?.find((attr: any) => attr.name === 'journey');
    //     if (journeyAttribute) {
    //         if (Array.isArray(journeyAttribute.value)) {
    //             const journeyDeviceOnly = journeyAttribute.value.find((v: any) => v.key === 'device_only');
    //             if (journeyDeviceOnly && journeyDeviceOnly.key) {
    //                 return journeyDeviceOnly.key;
    //             }
    //         } else {
    //             console.warn('Unexpected structure for journey attribute:', journeyAttribute.value);
    //         }
    //     }
    //     return undefined;
    // }

    public addItem = async (accessToken: string, id: string, body: any): Promise<any> => {
        try {
            const { error, value } = validateAddItemCartBody(body);
            if (error) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const now = new Date();
            const { productId, sku, quantity, productType, productGroup, addOnGroup } = value;

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await commercetoolsMeCartClient.getCartById(id);
            if (!cart) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Cart not found or has expired',
                };
            }
            // const cartJourney = cart.custom?.fields?.journey;

            const product = await CommercetoolsProductClient.getProductById(productId);
            if (!product) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Product not found',
                };
            }

            const variant = CommercetoolsProductClient.findVariantBySku(product, sku);
            if (!variant) {
                throw {
                    statusCode: 404,
                    statusMessage: 'SKU not found in the specified product',
                };
            }
            if (!variant.prices || variant.prices.length === 0) {
                throw {
                    statusCode: 404,
                    statusMessage: 'No prices found for this variant',
                };
            }

            // const variantJourneyDeviceOnly = this.getJourneyDeviceOnly(variant);
            // validateJourneyCompatibility(cartJourney, variantJourneyDeviceOnly);

            const validPrice = CommercetoolsProductClient.findValidPrice({
                prices: variant.prices,
                customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
                date: now,
            });
            if (!validPrice) {
                throw {
                    statusCode: 404,
                    statusMessage: 'No valid price found for the specified customer group and date range',
                };
            }

            const deltaQuantity = quantity;
            validateProductQuantity(
                productType,
                cart,
                sku,
                product.id,
                variant,
                deltaQuantity,
            );

            const inventories = await CommercetoolsInventoryClient.getInventory(sku);
            if (inventories.length === 0) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Inventory not found',
                };
            }
            const inventory = inventories[0];
            if (inventory.isOutOfStock) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Insufficient stock for the requested quantity',
                };
            }

            const newProductGroup = this.calculateProductGroup({
                cart,
                productId,
                sku,
                productType,
                productGroup,
            })

            const changes = [{
                sku,
                quantity,
                productType,
                productGroup: newProductGroup,
                addOnGroup
            }]

            if (productType === 'insurance') {
                const validateInsuranceResult = await commercetoolsMeCartClient.validateInsurance(cart, {
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

            const action = 'add_product'
            const validateResult = await talonOneEffectConverter.validate(cart, changes, action)

            if (!validateResult?.isValid) {
                return {
                    status: 'error',
                    message: validateResult?.errorMessage
                }
            }

            const updatedCart = await CommercetoolsCartClient.addItemToCart({
                cart,
                productId,
                variantId: variant.id,
                quantity,
                productType,
                productGroup: newProductGroup,
                addOnGroup,
                externalPrice: validPrice.value,
            });

            const iCartWithBenefit = await commercetoolsMeCartClient.updateCartWithBenefit(updatedCart);

            return iCartWithBenefit;
        } catch (error) {
            throw createStandardizedError(error, 'addItem');
        }
    }

    public updateItemQuantityById = async (accessToken: string, id: string, itemId: string, body: any): Promise<any> => {
        try {
            const { error, value } = validateUpdateCartItemBody(body);
            if (error) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const { productId, sku, quantity, productGroup, productType, addOnGroup } = value;

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await commercetoolsMeCartClient.getCartById(id);
            if (!cart) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Cart not found or has expired',
                };
            }

            const product = await CommercetoolsProductClient.getProductById(productId);
            if (!product) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Product not found',
                };
            }

            const variant = CommercetoolsProductClient.findVariantBySku(product, sku);
            if (!variant) {
                throw {
                    statusCode: 404,
                    statusMessage: 'SKU not found in the specified product',
                };
            }

            const inventories = await CommercetoolsInventoryClient.getInventory(sku);
            if (inventories.length === 0) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Inventory not found',
                };
            }
            const inventory = inventories[0];
            if (inventory.isOutOfStock) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Insufficient stock for the requested quantity',
                };
            }

            const existingLineItem = commercetoolsMeCartClient.findLineItem({ cart, variantId: variant.id, productGroup, productType, addOnGroup });
            if (!existingLineItem) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Line item not found in cart',
                };
            }
            const existingLineItemQuantity = existingLineItem.quantity;
            const deltaQuantity = quantity - existingLineItemQuantity;
            validateProductQuantity(
                productType,
                cart,
                sku,
                product.id,
                variant,
                deltaQuantity,
            );

            const changes = [{
                sku,
                quantity,
                productType,
                productGroup,
                addOnGroup
            }]

            const validateResult = await talonOneEffectConverter.validate(cart, changes)

            if (!validateResult?.isValid) {
                return {
                    status: 'error',
                    message: validateResult?.errorMessage
                }
            }

            const updatedCart = await commercetoolsMeCartClient.updateItemQuantityInCart({
                cart,
                variantId: variant.id,
                productGroup,
                productType,
                addOnGroup,
                quantity
            });

            const iCartWithBenefit = await commercetoolsMeCartClient.updateCartWithBenefit(updatedCart);

            return iCartWithBenefit;
        } catch (error) {
            throw createStandardizedError(error, 'updateItemQuantityById');
        }
    }

    public deleteItemById = async (accessToken: string, id: string, itemId: string, body: any): Promise<any> => {
        try {
            const { error, value } = validateDeleteCartItemBody(body);
            if (error) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const { productId, sku, productGroup, productType, addOnGroup } = value;

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await commercetoolsMeCartClient.getCartById(id);
            if (!cart) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Cart not found or has expired',
                };
            }

            const product = await CommercetoolsProductClient.getProductById(productId);
            if (!product) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Product not found',
                };
            }

            const variant = CommercetoolsProductClient.findVariantBySku(product, sku);
            if (!variant) {
                throw {
                    statusCode: 404,
                    statusMessage: 'SKU not found in the specified product',
                };
            }

            let updatedCart = await commercetoolsMeCartClient.removeItemFromCart({
                cart,
                variantId: variant.id,
                productType,
                productGroup,
                addOnGroup
            });

            updatedCart = await commercetoolsMeCartClient.resetCartItemProductGroup(updatedCart)

            const iCartWithBenefit = await commercetoolsMeCartClient.updateCartWithBenefit(updatedCart);

            return iCartWithBenefit;
        } catch (error) {
            throw createStandardizedError(error, 'deleteItemById');
        }
    }

    public bulkDelete = async (accessToken: string, id: string, body: any): Promise<any> => {
        try {
            const { error, value } = validateBulkDeleteCartItemBody(body);
            if (error) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const { items } = value;

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await commercetoolsMeCartClient.getCartById(id);
            if (!cart) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Cart not found or has expired',
                };
            }

            const lineItemKeys: any[] = [];
            for (const item of items) {
                const { productId, sku, productGroup, productType, addOnGroup } = item;
                const product = await CommercetoolsProductClient.getProductById(productId);
                if (!product) {
                    throw {
                        statusCode: 404,
                        statusMessage: `Product with ID ${productId} not found.`,
                    };
                }

                const variant = CommercetoolsProductClient.findVariantBySku(product, sku);
                if (!variant) {
                    throw {
                        statusCode: 404,
                        statusMessage: `SKU ${sku} not found in product ${productId}.`,
                    };
                }

                lineItemKeys.push({
                    variantId: variant.id,
                    productGroup,
                    productType,
                    addOnGroup
                });
            }

            const updatedCart = await commercetoolsMeCartClient.removeItemsFromCart(cart, lineItemKeys);

            const iCartWithBenefit = await commercetoolsMeCartClient.updateCartWithBenefit(updatedCart);

            return iCartWithBenefit;
        } catch (error) {
            throw createStandardizedError(error, 'bulkDelete');
        }
    }

    public select = async (accessToken: string, id: string, body: any): Promise<any> => {
        try {
            const { value, error } = validateSelectCartItemBody(body);
            if (error) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Validation failed',
                    data: error.details.map((err) => err.message),
                };
            }

            const { items } = value;

            const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

            const cart = await commercetoolsMeCartClient.getCartById(id);
            if (!cart) {
                throw {
                    statusCode: 404,
                    statusMessage: 'Cart not found or has expired',
                };
            }

            const updateActions: MyCartUpdateAction[] = [];

            for (const item of items) {
                const { sku, productType, productGroup, selected } = item;

                const lineItem = cart.lineItems.find((lineItem: any) => {
                    return lineItem.variant.sku === sku
                        && lineItem.custom?.fields?.productGroup == productGroup
                        && lineItem.custom?.fields?.productType === productType;
                });

                if (!lineItem) {
                    throw {
                        statusCode: 404,
                        statusMessage: `Line item with SKU ${sku} not found in the cart.`,
                    };
                }

                const action: MyCartUpdateAction = {
                    action: 'setLineItemCustomField',
                    lineItemId: lineItem.id,
                    name: 'selected',
                    value: selected,
                };

                updateActions.push(action);
            }

            const updatedCart = await commercetoolsMeCartClient.updateCart(
                cart.id,
                cart.version,
                updateActions,
            );

            const iCartWithBenefit = await commercetoolsMeCartClient.updateCartWithBenefit(updatedCart);

            return iCartWithBenefit;
        } catch (error) {
            throw createStandardizedError(error, 'select');
        }
    }

    calculateProductGroup = ({
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
        if (['add_on', 'insurance'].includes(productType)) {
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
}
