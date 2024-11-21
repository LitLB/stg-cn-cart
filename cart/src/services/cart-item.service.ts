// cart/src/services/cart-item.service.ts

import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import { validateAddItemCartBody, validateProductQuantity } from '../validators/cart-item.validator';
import { talonOneEffectConverter } from '../adapters/talon-one-effect-converter';
import { readConfiguration } from '../utils/config.utils';

export class CartItemService {
    public addItem = async (accessToken: string, id: string, itemId: string, body: any): Promise<any> => {
        const { error, value } = validateAddItemCartBody(body);
        if (error) {
            throw {
                statusCode: 400,
                statusMessage: 'Validation failed',
                data: error.details.map((err) => err.message),
            };
        }
        console.log('value', value);

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
