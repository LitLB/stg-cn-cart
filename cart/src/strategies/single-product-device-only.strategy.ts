import { Cart, MyCartUpdateAction, Product } from '@commercetools/platform-sdk';
import { CommercetoolsCartClient } from '../adapters/ct-cart-client';
import { CommercetoolsInventoryClient } from '../adapters/ct-inventory-client';
import { CommercetoolsProductClient } from '../adapters/ct-product-client';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { createStandardizedError } from '../utils/error.utils';
import { BaseCartStrategy } from './base-cart.strategy';
import { CART_JOURNEYS } from '../constants/cart.constant';
import { InventoryValidator } from '../validators/inventory.validator';
import { HTTP_STATUSES } from '../constants/http.constant';
import {
  validateBulkDeleteCartItemBody,
  validateDeleteCartItemBody,
  validateProductQuantity,
  validateProductReleaseDate,
  validateSelectCartItemBody,
  validateSkuStatus,
  validateUpdateCartItemBody,
} from '../schemas/cart-item.schema';
import { readConfiguration } from '../utils/config.utils';
import { updateCartFlag, validateInventory } from '../utils/cart.utils';
import { TalonOneEffectConverter } from '../adapters/talon-one-effect-converter';
import { CouponService } from '../services/coupon.service';
import { TalonOneIntegrationAdapter } from '../adapters/talon-one.adapter';

export class SingleProductDeviceOnlyCartStrategy extends BaseCartStrategy {
  private couponService: CouponService;

  constructor() {
    super(
      CommercetoolsProductClient,
      CommercetoolsCartClient,
      CommercetoolsInventoryClient,
      TalonOneEffectConverter,
      TalonOneIntegrationAdapter
    );

    this.couponService = new CouponService();
  }

  set accessToken(value: string) {
    const adapter = new CommercetoolsMeCartClient(value);
    this.adapters[adapter.name] = adapter;
  }

  public async addItem(cart: Cart, payload: any): Promise<any> {
    try {
      const now = new Date();
      const {
        productId,
        sku,
        quantity,
        productType,
        productGroup,
        addOnGroup,
        freeGiftGroup,
        campaignVerifyValues = [],
      } = payload;

      const product =
        await this.adapters.commercetoolsProductClient.getProductById(
          productId
        );
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

      // Override journey level cart gonna be product journey to validation
      const journey = this.determineJourney(
        product,
        cart.custom?.fields?.journey as CART_JOURNEYS,
        payload?.journey
      );

      await InventoryValidator.validateLineItemUpsert(
        cart,
        sku,
        quantity,
        journey,
        payload.campaignVerifyValues && payload.campaignVerifyValues.length > 0
      );
      const variant = this.adapters.commercetoolsProductClient.findVariantBySku(
        product,
        sku
      );

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

      const isValidReleaseDate = validateProductReleaseDate(
        variant.attributes,
        now
      );

      if (!isValidReleaseDate) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'Product release date is not in period',
        };
      }

      if (!variant.attributes || variant.attributes.length === 0) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'No attributes found for this variant',
        };
      }

      validateSkuStatus(variant.attributes);

      const validPrice =
        this.adapters.commercetoolsProductClient.findValidPrice({
          prices: variant.prices,
          customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
          date: now,
        });
      if (!validPrice) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage:
            'No valid price found for the specified customer group and date range',
        };
      }

      const deltaQuantity = quantity;
      validateProductQuantity(
        productType,
        cart,
        sku,
        product.id,
        variant,
        deltaQuantity
      );

      const inventories =
        await this.adapters.commercetoolsInventoryClient.getInventory(sku);
      if (inventories.length === 0) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'Inventory not found',
        };
      }

      const inventory = inventories[0];
      const { isDummyStock, isOutOfStock } = validateInventory(inventory);

      if (isOutOfStock && !isDummyStock) {
        throw {
          statusCode: HTTP_STATUSES.BAD_REQUEST,
          statusMessage: 'Insufficient stock for the requested quantity',
        };
      }

      const newProductGroup = this.calculateProductGroup({
        cart,
        productId,
        sku,
        productType,
        productGroup,
      });

      if (productType === 'insurance') {
        const validateInsuranceResult =
          await this.adapters.commercetoolsMeCartClient.validateInsurance(
            cart,
            {
              productGroup: newProductGroup,
              productId,
              sku,
            }
          );

        if (!validateInsuranceResult?.isValid) {
          return {
            status: 'error',
            message: validateInsuranceResult?.errorMessage,
          };
        }
      }

      const changes = [
        {
          sku,
          quantity,
          productType,
          productGroup: newProductGroup,
          addOnGroup,
          freeGiftGroup,
          campaignVerifyValues,
        },
      ];
      const action = 'add_product';
      const validateResult =
        await this.adapters.talonOneEffectConverter.validate(
          cart,
          changes,
          action
        );

      if (
        !validateResult?.isValid &&
        (validateResult as any)?.isRequireCampaignVerify
      ) {
        throw createStandardizedError(
          {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            statusMessage: validateResult?.errorMessage,
            errorCode: 'CAMPAIGN_VERIFY_KEY_IS_REQUIRED',
            data: {
              requestBody: {
                ...payload,
              },
              campaignVerifyKeys: (validateResult as any)?.campaignVerifyKeys,
            },
          },
          'addItem'
        );
      }

      if (!validateResult?.isValid) {
        throw createStandardizedError(
          {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            statusMessage: validateResult?.errorMessage,
            errorCode: (validateResult as any).errorCode,
          },
          'addItem'
        );
      }

      // TODO: filter out campaignVerifyValues that does not allow
      const allowCampaignVerifyKeys =
        (validateResult as { allowCampaignVerifyKeys?: any[] })
          .allowCampaignVerifyKeys ?? [];
      const { campaignVerifyKeys: allowCampaignVerifyKeysForCurrentItem = [] } =
        allowCampaignVerifyKeys.find(
          (item: any) =>
            item.sku === sku &&
            item.productType === productType &&
            item.productGroup === newProductGroup
        ) || {};

      const filteredCampaignVerifyValues = campaignVerifyValues.filter(
        (campaignVerifyValue: any) => {
          return allowCampaignVerifyKeysForCurrentItem.find(
            (allowCampaignVerifyKey: any) =>
              allowCampaignVerifyKey.name === campaignVerifyValue.name
          );
        }
      );

      const updatedCart =
        await this.adapters.commercetoolsCartClient.addItemToCart({
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
          journey,
        });

      const ctCartWithChanged: Cart =
        await this.adapters.commercetoolsProductClient.checkCartHasChanged(
          updatedCart
        );
      const { ctCart: cartWithUpdatedPrice, compared } =
        await this.adapters.commercetoolsCartClient.updateCartWithNewValue(
          ctCartWithChanged
        );
      const updateCartWithOperator =
        await this.adapters.commercetoolsCartClient.updateCartWithOperator(
          cartWithUpdatedPrice,
          payload.operator
        );
      const iCartWithBenefit =
        await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(
          updateCartWithOperator
        );

      return { ...iCartWithBenefit, hasChanged: compared };
    } catch (error: any) {
      console.log('error', error);

      if (error.status && error.message) {
        throw error;
      }

      throw createStandardizedError(error, 'addItem');
    }
  }

  public async updateItem(cart: Cart, body: any): Promise<any> {
    try {
      const { error, value } = validateUpdateCartItemBody(body);

      const now = new Date();

      if (error) {
        throw {
          statusCode: HTTP_STATUSES.BAD_REQUEST,
          statusMessage: 'Validation failed',
          data: error.details.map((err) => err.message),
        };
      }

      const {
        productId,
        sku,
        quantity,
        productGroup,
        productType,
        addOnGroup,
        freeGiftGroup,
      } = value;

      const product =
        await this.adapters.commercetoolsProductClient.getProductById(
          productId
        );
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
      // Override journey level cart gonna be product journey to validation
      const journey = this.determineJourney(
        product,
        cart.custom?.fields?.journey as CART_JOURNEYS
      );

      // const journey = cart.custom?.fields?.journey as CART_JOURNEYS;
      await InventoryValidator.validateLineItemReplaceQty(
        cart,
        sku,
        quantity,
        journey
      );

      const variant = this.adapters.commercetoolsProductClient.findVariantBySku(
        product,
        sku
      );
      if (!variant) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'SKU not found in the specified product',
        };
      }

      const isValidReleaseDate = validateProductReleaseDate(
        variant.attributes,
        now
      );

      if (!isValidReleaseDate) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'Product release date is not in period',
        };
      }

      const inventories =
        await this.adapters.commercetoolsInventoryClient.getInventory(sku);
      if (inventories.length === 0) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'Inventory not found',
        };
      }
      const inventory = inventories[0];
      const { isDummyStock, isOutOfStock } = validateInventory(inventory);

      if (isOutOfStock && !isDummyStock) {
        throw {
          statusCode: HTTP_STATUSES.BAD_REQUEST,
          statusMessage: 'Insufficient stock for the requested quantity',
        };
      }

      const existingLineItem =
        this.adapters.commercetoolsMeCartClient.findLineItem({
          cart,
          productId,
          variantId: variant.id,
          productGroup,
          productType,
          addOnGroup,
          freeGiftGroup,
        });
      if (!existingLineItem) {
        throw {
          statusCode: HTTP_STATUSES.BAD_REQUEST,
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
        deltaQuantity
      );

      const changes = [
        {
          sku,
          quantity,
          productType,
          productGroup,
          addOnGroup,
        },
      ];

      const validateResult =
        await this.adapters.talonOneEffectConverter.validate(cart, changes);

      if (!validateResult?.isValid) {
        return {
          status: 'error',
          message: validateResult?.errorMessage,
        };
      }

      let updatedCart =
        await this.adapters.commercetoolsMeCartClient.updateItemQuantityInCart({
          cart,
          productId,
          variantId: variant.id,
          productGroup,
          productType,
          addOnGroup,
          freeGiftGroup,
          quantity,
        });

      const customerSession =
        await this.adapters.talonOneIntegrationAdapter.getCustomerSession(
          updatedCart.id
        );

      if (updatedCart.lineItems.length === 0) {
        updatedCart = await this.couponService.clearAllCoupons(
          updatedCart,
          customerSession
        );
      }

      const ctCartWithChanged: Cart =
        await this.adapters.commercetoolsProductClient.checkCartHasChanged(
          updatedCart
        );
      const { ctCart: cartWithUpdatedPrice, compared } =
        await this.adapters.commercetoolsCartClient.updateCartWithNewValue(
          ctCartWithChanged
        );

      const iCartWithBenefit =
        await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(
          cartWithUpdatedPrice
        );

      return { ...iCartWithBenefit, hasChanged: compared };
    } catch (error: any) {
      if (error.status && error.message) {
        throw error;
      }

      throw createStandardizedError(error, 'updateItemQuantityById');
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

      const {
        productId,
        sku,
        productGroup,
        productType,
        addOnGroup,
        freeGiftGroup,
      } = value;

      const product =
        await this.adapters.commercetoolsProductClient.getProductById(
          productId
        );
      if (!product) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'Product not found',
        };
      }

      const variant = this.adapters.commercetoolsProductClient.findVariantBySku(
        product,
        sku
      );
      if (!variant) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'SKU not found in the specified product',
        };
      }

      let updatedCart =
        await this.adapters.commercetoolsMeCartClient.removeItemFromCart({
          cart,
          productId,
          variantId: variant.id,
          productType,
          productGroup,
          addOnGroup,
          freeGiftGroup,
        });

      const customerSession =
        await this.adapters.talonOneIntegrationAdapter.getCustomerSession(
          updatedCart.id
        );

      if (updatedCart.lineItems.length === 0) {
        updatedCart = await this.couponService.clearAllCoupons(
          updatedCart,
          customerSession
        );
      }

      updatedCart =
        await this.adapters.commercetoolsMeCartClient.resetCartItemProductGroup(
          updatedCart
        );

      let iCartWithBenefit =
        await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(
          updatedCart
        );
      iCartWithBenefit = updateCartFlag(iCartWithBenefit);

      return iCartWithBenefit;
    } catch (error: any) {
      if (error.status && error.message) {
        throw error;
      }

      throw createStandardizedError(error, 'deleteItemById');
    }
  }

  public async bulkRemoveItems(cart: Cart, body: any): Promise<any> {
    try {
      const { error, value } = validateBulkDeleteCartItemBody(body);
      if (error) {
        throw {
          statusCode: HTTP_STATUSES.BAD_REQUEST,
          statusMessage: 'Validation failed',
          data: error.details.map((err) => err.message),
        };
      }

      const { items } = value;

      const lineItemKeys: any[] = [];
      for (const item of items) {
        const {
          productId,
          sku,
          productGroup,
          productType,
          addOnGroup,
          freeGiftGroup,
        } = item;
        const product =
          await this.adapters.commercetoolsProductClient.getProductById(
            productId
          );
        if (!product) {
          throw {
            statusCode: HTTP_STATUSES.NOT_FOUND,
            statusMessage: `Product with ID ${productId} not found.`,
          };
        }

        const variant =
          this.adapters.commercetoolsProductClient.findVariantBySku(
            product,
            sku
          );
        if (!variant) {
          throw {
            statusCode: HTTP_STATUSES.NOT_FOUND,
            statusMessage: `SKU ${sku} not found in product ${productId}.`,
          };
        }

        lineItemKeys.push({
          productId,
          variantId: variant.id,
          productGroup,
          productType,
          addOnGroup,
          freeGiftGroup,
        });
      }

      let updatedCart =
        await this.adapters.commercetoolsMeCartClient.removeItemsFromCart(
          cart,
          lineItemKeys
        );

      const customerSession =
        await this.adapters.talonOneIntegrationAdapter.getCustomerSession(
          updatedCart.id
        );

      if (updatedCart.lineItems.length === 0) {
        updatedCart = await this.couponService.clearAllCoupons(
          updatedCart,
          customerSession
        );
      }

      let iCartWithBenefit =
        await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(
          updatedCart
        );
      iCartWithBenefit = updateCartFlag(iCartWithBenefit);

      return iCartWithBenefit;
    } catch (error: any) {
      if (error.status && error.message) {
        throw error;
      }

      throw createStandardizedError(error, 'bulkDelete');
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
        const { sku, productType, productGroup, selected } = item;

        const lineItem = cart.lineItems.find((lineItem: any) => {
          return (
            lineItem.variant.sku === sku &&
            lineItem.custom?.fields?.productGroup == productGroup &&
            lineItem.custom?.fields?.productType === productType
          );
        });

        if (!lineItem) {
          throw {
            statusCode: HTTP_STATUSES.NOT_FOUND,
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

      const updatedCart =
        await this.adapters.commercetoolsMeCartClient.updateCart(
          cart.id,
          cart.version,
          updateActions
        );

      const ctCartWithChanged: Cart =
        await this.adapters.commercetoolsProductClient.checkCartHasChanged(
          updatedCart
        );
      const { ctCart: cartWithUpdatedPrice, compared } =
        await this.adapters.commercetoolsCartClient.updateCartWithNewValue(
          ctCartWithChanged
        );

      const iCartWithBenefit =
        await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(
          cartWithUpdatedPrice
        );

      return { ...iCartWithBenefit, hasChanged: compared };
    } catch (error: any) {
      if (error.status && error.message) {
        throw error;
      }

      throw createStandardizedError(error, 'select');
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

  private determineJourney(
    product: Product,
    journeyDefault: CART_JOURNEYS,
    payloadJourney?: string
  ): CART_JOURNEYS {
    let journey = journeyDefault;

    if (!payloadJourney) {
      const [foundJourney] =
        this.adapters.commercetoolsProductClient.findProductJourney(product);
      journey = foundJourney?.key
        ? foundJourney.key
        : CART_JOURNEYS.SINGLE_PRODUCT;
    } else {
      journey = payloadJourney as CART_JOURNEYS;
    }

    return journey;
  }
}
