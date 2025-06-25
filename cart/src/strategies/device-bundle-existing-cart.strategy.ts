import {
  Cart,
  CustomObject,
  LineItem,
  Money,
  MyCartUpdateAction,
  Product,
  ProductVariant,
} from '@commercetools/platform-sdk';
import { CommercetoolsCartClient } from '../adapters/ct-cart-client';
import { CommercetoolsInventoryClient } from '../adapters/ct-inventory-client';
import { CommercetoolsProductClient } from '../adapters/ct-product-client';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import { BaseCartStrategy } from './base-cart.strategy';
import { createStandardizedError } from '../utils/error.utils';
import { InventoryValidator } from '../validators/inventory.validator';
import { CART_JOURNEYS } from '../constants/cart.constant';
import { HTTP_STATUSES } from '../constants/http.constant';
import {
  validateBulkDeleteCartItemBody,
  validateProductQuantity,
  validateProductReleaseDate,
  validateSelectCartItemBody,
  validateSkuStatus,
  validateUpdateCartItemBody,
} from '../schemas/cart-item.schema';
import { readConfiguration } from '../utils/config.utils';
import { validateInventory } from '../utils/cart.utils';
import { LINE_ITEM_INVENTORY_MODES } from '../constants/lineItem.constant';
import { CommercetoolsCustomObjectClient } from '../adapters/ct-custom-object-client';
import _ from 'lodash';
import { attachPackageToCart } from '../helpers/cart.helper';
import { AdapterConstructor } from '../interfaces/adapter.interface';
import { CommercetoolsStandalonePricesClient } from '../adapters/ct-standalone-prices-client';
import { ICartItemPayload } from '../interfaces/cart';
import dayjs from 'dayjs';
import { CartService } from '../services/cart.service';

export class DeviceBundleExistingCartStrategy extends BaseCartStrategy<{
  'commercetoolsMeCartClient': CommercetoolsMeCartClient,
  'commercetoolsProductClient': CommercetoolsProductClient,
  'commercetoolsCartClient': CommercetoolsCartClient,
  'commercetoolsInventoryClient': CommercetoolsInventoryClient,
  'commercetoolsCustomObjectClient': CommercetoolsCustomObjectClient,
  'commercetoolsStandalonePricesClient': CommercetoolsStandalonePricesClient,

}> {
  constructor() {
    super(
      CommercetoolsProductClient as AdapterConstructor<'commercetoolsProductClient', CommercetoolsProductClient>,
      CommercetoolsCartClient as AdapterConstructor<'commercetoolsCartClient', CommercetoolsCartClient>,
      CommercetoolsInventoryClient as AdapterConstructor<'commercetoolsInventoryClient', CommercetoolsInventoryClient>,
      CommercetoolsCustomObjectClient as AdapterConstructor<'commercetoolsCustomObjectClient', CommercetoolsCustomObjectClient>,
      CommercetoolsStandalonePricesClient as AdapterConstructor<'commercetoolsStandalonePricesClient', CommercetoolsStandalonePricesClient>,
    );
  }

  set accessToken(value: string) {
    const adapter = new CommercetoolsMeCartClient(value);
    this.adapters[adapter.name] = adapter;
  }

  protected async getProductById(id: string): Promise<Product> {
    const product =
      await this.adapters.commercetoolsProductClient.getProductById(id);
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

    return product;
  }

  protected async getBundleProductByKey(key: string): Promise<Product> {
    const bundleProduct =
      await this.adapters.commercetoolsProductClient.queryProducts({
        where: `masterData(current(masterVariant(sku="${key}")))`,
      });

    if (!bundleProduct.results.length) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'Bundle product not found',
      };
    }

    if (!bundleProduct.results[0].masterData.published) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'Bundle product is no longer available.',
      };
    }

    return bundleProduct.results[0];
  }

  protected async getPromotionSetByCode(code: string): Promise<Product> {
    const promotionSet =
      await this.adapters.commercetoolsProductClient.queryProducts({
        where: `masterData(current(masterVariant(sku="${code}")))`,
      });

    if (!promotionSet.results.length) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'Promotion set not found',
      };
    }

    if (!promotionSet.results[0].masterData.published) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'Promotion set is no longer available.',
      };
    }

    return promotionSet.results[0];
  }

  protected async getPackageByCode(code: string): Promise<Product> {
    const mainPackage =
      await this.adapters.commercetoolsProductClient.queryProducts({
        where: `masterData(current(masterVariant(attributes(name="package_code")))) and masterData(current(masterVariant(attributes(value="${code}"))))`,
      });

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

    return mainPackage.results[0];
  }

  protected getVariantBySku(product: Product, sku: string): ProductVariant {
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


    if (!variant.attributes || variant.attributes.length === 0) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'No attributes found for this variant',
      };
    }

    return variant;
  }

  protected validateReleaseDate(attributes: any[], today: Date) {
    const isValidReleaseDate = validateProductReleaseDate(attributes, today);

    if (!isValidReleaseDate) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'Product release date is not in period',
      };
    }
  }

  protected validateStatus(variant: ProductVariant): void {
    validateSkuStatus(variant.attributes!);
  }

  protected async getValidPrice(variant: ProductVariant, today: Date) {
    if (!variant.sku) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'SKU not found in the specified variant',
      };
    }

    const standalonePrice = await this.adapters.commercetoolsStandalonePricesClient.getStandalonePricesBySku(variant.sku)

    if (standalonePrice.length === 0) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage:
          'No standalone price found for the specified SKU',
      };
    }

    const validPrice = this.adapters.commercetoolsProductClient.findValidPrice({
      prices: standalonePrice,
      customerGroupId: readConfiguration().ctPriceCustomerGroupIdRrp,
      date: today,
    });

    if (!validPrice) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage:
          'No valid price found for the specified customer group and date range',
      };
    }

    return validPrice;
  }

  protected validateQuantity(
    productType: string,
    cart: Cart,
    sku: string,
    product: Product,
    variant: ProductVariant,
    deltaQuantity: number
  ) {
    const cartQuantity = this.getItemQuantityBySku(cart, sku);

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
      deltaQuantity
    );
  }

  protected getItemQuantityBySku(cart: Cart, sku: string) {
    return cart.lineItems
      .filter((item: LineItem) => item.variant.sku === sku)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  protected async getInventories(skus: string) {
    const inventories =
      await this.adapters.commercetoolsInventoryClient.getInventory(skus);
    if (inventories.length === 0) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'Inventory not found',
      };
    }

    return inventories;
  }

  protected validateInventory(inventory: any): any {
    const { isDummyStock, isOutOfStock } = validateInventory(inventory);

    if (isOutOfStock && !isDummyStock) {
      throw {
        statusCode: HTTP_STATUSES.BAD_REQUEST,
        statusMessage: 'Insufficient stock for the requested quantity',
      };
    }

    return { isDummyStock, isOutOfStock };
  }

  protected async getPackageAdditionalInfo(
    cart: Cart,
    mainPackage: ProductVariant,
    bundle: ProductVariant,
    advancePayment: number
  ): Promise<CustomObject> {
    const packageCode = mainPackage.attributes?.find(
      (attr) => attr.name === 'package_code'
    );
    const packageName = mainPackage.attributes?.find(
      (attr) => attr.name === 'package_name'
    );
    const priceplanRc = mainPackage.attributes?.find(
      (attr) => attr.name === 'priceplan_rc'
    );

    const contractTerm = bundle.attributes?.find((attr) => attr.name === 'contractTerm')
    const penalty = bundle.attributes?.find((attr) => attr.name === 'contractFee')?.value * 100 // ? Convert baht to stang

    const packageCustomObj =
      await this.adapters.commercetoolsCustomObjectClient.createOrUpdateCustomObject(
        {
          container: 'package-info',
          key: `pkg-${cart.id}`,
          value: {
            package_code: packageCode?.value,
            name: packageName?.value,
            t1: {
              priceplanRcc: priceplanRc?.value,
              penalty: penalty,
              advancedPayment: advancePayment,
              contractTerm: contractTerm?.value || 12,
            },
            connector: {
              description: packageName?.value
            },
          },
        }
      );

    return packageCustomObj;
  }

  protected validateDeviceBundleExisting(
    body: any,
    cart: Cart,
    variant: ProductVariant
  ) {
    const { package: mainPackage, sku } = body;

    const mainProductLineItems = cart.lineItems.filter(
      (item: LineItem) => item.custom?.fields?.productType === 'main_product'
    );

    const totalCartQuantity = mainProductLineItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    if (_.isEmpty(mainPackage)) {
      throw {
        statusCode: HTTP_STATUSES.BAD_REQUEST,
        statusMessage:
          '"package.code" is required for journey "device_bundle_existing"',
      };
    }

    if (totalCartQuantity > 1) {
      throw {
        statusCode: HTTP_STATUSES.BAD_REQUEST,
        statusMessage: `Cannot have more than 1 unit of SKU ${sku} in the cart.`,
      };
    }

    if (
      !variant.attributes?.some(
        (value) =>
          value.name === 'journey' &&
          value.value.some(
            (journey: any) =>
              journey.key === CART_JOURNEYS.DEVICE_BUNDLE_EXISTING
          )
      )
    ) {
      throw {
        statusCode: HTTP_STATUSES.BAD_REQUEST,
        statusMessage: `Cannot add a non-"device_bundle_existing" item to a "device_bundle_existing" cart.`,
      };
    }
  }

  private findValidAdvancePayment = (advancePaymentList: string[]): number => {
    const now = dayjs()
    const advancePaymentParsed = advancePaymentList.map(r => JSON.parse(r))
    const validAdvancePayment = advancePaymentParsed.find((adv: { fee: number, startDate: string; endDate: string }) => {

      const startDate = dayjs(adv.startDate.split("/").reverse().join(""))
      const endDate = dayjs(adv.endDate.split("/").reverse().join(""))

      const validStartDate: boolean = (now.isSame(startDate) || now.isAfter(startDate))
      const validEndDate: boolean = (now.isSame(endDate) || now.isBefore(endDate))

      return validStartDate && validEndDate
    }).fee.concat("00") // ? convert bath to cent

    return Number(validAdvancePayment ?? 0)
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

  public async addItem(cart: Cart, payload: ICartItemPayload, headers: any): Promise<any> {
    try {

      let eligibleResponse: any[] = []
      let otherPayments: { code: string, amount: number }[] = []
      let discounts: { code: string, amount: number }[] = []
      let directDiscounts

      const cartService = new CartService()
      const now = new Date();
      const {
        package: packageInfo,
        productId,
        sku,
        quantity,
        productType,
        productGroup,
        campaignVerifyValues,
        bundleProduct
      } = payload;
      const journey = cart.custom?.fields?.journey as CART_JOURNEYS;

      await InventoryValidator.validateLineItemUpsert(
        cart,
        sku,
        quantity,
        journey,
        campaignVerifyValues && campaignVerifyValues.length > 0
      );

      const product = await this.getProductById(productId);
      const variant = this.getVariantBySku(product, sku);


      this.validateDeviceBundleExisting(payload, cart, variant);
      let validPrice

      if (productType === 'main_product') {
        validPrice = await this.getValidPrice(variant, now);
      }
      const mainPackage = await this.getPackageByCode(packageInfo.code);
      const promotionSetInfo = await this.getPromotionSetByCode(bundleProduct.promotionSetCode)
      const bundleProductInfo = await this.getBundleProductByKey(bundleProduct.key)

      if (!bundleProductInfo) {
        throw {
          statusCode: HTTP_STATUSES.NOT_FOUND,
          statusMessage: 'Bundle product notfound.',
        };
      }

      
      const bundleProductAttributes = bundleProductInfo.masterData.current.masterVariant.attributes
      const bundleProductData = {
        campaignCode: bundleProductAttributes?.find(attr => attr.name === 'campaignCode')?.value,
        propositionCode: bundleProductAttributes?.find(attr => attr.name === 'propositionCode')?.value,
        promotionSetCode: bundleProductAttributes?.find(attr => attr.name === 'promotionSetCode')?.value,
        agreementCode: bundleProductAttributes?.find(attr => attr.name === 'agreementCode')?.value
      }

      if (bundleProductInfo) {
        const checkEligible = await cartService.checkEligible(cart, sku, bundleProductData, headers)
        eligibleResponse = checkEligible?.prices?.discounts ?? []
        otherPayments = eligibleResponse.filter((r: any) => r.type === 'otherPayment')
        discounts = eligibleResponse.filter((r: any) => r.type === 'discount')
        directDiscounts = eligibleResponse
      }

      const advancePaymentList: string[] = bundleProductInfo.masterData.current.masterVariant.attributes?.find(r => r.name === 'payAdvanceServiceFee')?.value ?? "0"

      const advancePayment = this.findValidAdvancePayment(advancePaymentList)

      const packageAdditionalInfo = await this.getPackageAdditionalInfo(
        cart,
        mainPackage.masterData.current.masterVariant,
        bundleProductInfo.masterData.current.masterVariant,
        advancePayment
      );

      this.validateReleaseDate(variant.attributes!, now);
      this.validateStatus(variant);
      this.validateQuantity(productType, cart, sku, product, variant, quantity);

      const inventories = await this.getInventories(sku);
      const inventory = inventories[0];

      const { isDummyStock } = this.validateInventory(inventory);

      const updatedCart =
        await this.adapters.commercetoolsCartClient.updateCart(
          cart.id,
          cart.version,
          [
            {
              action: 'addLineItem',
              productId: product.id,
              variantId: variant.id,
              quantity: quantity,
              supplyChannel: {
                typeId: 'channel',
                id: readConfiguration().ctpSupplyChannel,
              },
              inventoryMode: isDummyStock ? LINE_ITEM_INVENTORY_MODES.TRACK_ONLY : LINE_ITEM_INVENTORY_MODES.RESERVE_ON_ORDER,
              externalPrice: validPrice.value,
              custom: {
                type: {
                  typeId: 'type',
                  key: 'lineItemCustomType',
                },
                fields: {
                  productType,
                  productGroup,
                  selected: true,
                  isPreOrder: false,
                  journey,
                },
              },
            },
            {
              action: 'addLineItem',
              productId: mainPackage.id,
              variantId: mainPackage.masterData.current.masterVariant.id,
              quantity: 1,
              inventoryMode: LINE_ITEM_INVENTORY_MODES.NONE,
              externalPrice: {
                currencyCode: 'THB',
                centAmount: 0,
              },
              custom: {
                type: {
                  typeId: 'type',
                  key: 'lineItemCustomType',
                },
                fields: {
                  productType: 'package',
                  selected: true,
                },
              },
            },
            {
              action: 'addLineItem',
              productId: bundleProductInfo.id,
              variantId: bundleProductInfo.masterData.current.masterVariant.id,
              quantity: 1,
              inventoryMode: LINE_ITEM_INVENTORY_MODES.NONE,
              externalPrice: {
                currencyCode: 'THB',
                centAmount: 0,
              },
              custom: {
                type: {
                  typeId: 'type',
                  key: 'lineItemCustomType',
                },
                fields: {
                  productType: 'product-bundle',
                  selected: true,
                },
              },
            },
            {
              action: 'addLineItem',
              productId: promotionSetInfo.id,
              variantId: promotionSetInfo.masterData.current.masterVariant.id,
              quantity: 1,
              inventoryMode: LINE_ITEM_INVENTORY_MODES.NONE,
              externalPrice: {
                currencyCode: 'THB',
                centAmount: 0,
              },
              custom: {
                type: {
                  typeId: 'type',
                  key: 'lineItemCustomType',
                },
                fields: {
                  productType: 'promotion_set',
                  selected: true,
                },
              },
            },
            {
              action: 'addCustomLineItem',
              name: {
                'en-US': 'Advanced Payment',
                'th-TH': 'ค่าบริการล่วงหน้า',
              },
              quantity: 1,
              money: {
                currencyCode: 'THB',
                centAmount: advancePayment,
              },
              slug: 'advance-payment',
              taxCategory: {
                typeId: 'tax-category',
                id: readConfiguration().ctpTaxCategoryId,
              },
            },
            {
              action: 'setCustomField',
              name: 'packageAdditionalInfo',
              value: {
                typeId: 'key-value-document',
                id: packageAdditionalInfo.id,
              },
            },
            {
              action: "setDirectDiscounts",
              discounts: directDiscounts && directDiscounts.length > 0 ? directDiscounts?.map(r => {
                return {
                  value: {
                    type: "absolute",
                    money: [{
                      centAmount: r.amount * 100,
                      currencyCode: "THB",
                      type: 'centPrecision',
                      fractionDigits: 2,
                    }]
                  },
                  target: {
                    type: "lineItems",
                    predicate: `sku="${sku}"`
                  }
                }
              }) : []
            }
          ]
        );

      const lineItemId = updatedCart.lineItems.find((lineItem: LineItem) => lineItem.productId === productId)?.id

      const cartWithDiscount = await this.adapters.commercetoolsCartClient.updateCart(updatedCart.id, updatedCart.version, [
        {
          action: "setLineItemCustomField",
          lineItemId: lineItemId,
          name: "discounts",
          value: (discounts && Array.isArray(discounts))
            ? discounts.map((discount: any) => (JSON.stringify({
              code: discount.code,
              amount: discount.amount * 100, // convert to cent
            })))
            : [],
        },
        {
          action: "setLineItemCustomField",
          lineItemId: lineItemId,
          name: "otherPayments",
          value: (otherPayments && Array.isArray(otherPayments))
            ? otherPayments.map((otherPayment: any) => (JSON.stringify({
              code: otherPayment.code,
              amount: otherPayment.amount * 100, // convert to cent
            })))
            : [],
        }
      ])

      // let iCart: ICart = this.adapters.commercetoolsMeCartClient.mapCartToICart(updatedCart);
      const ctCartWithChanged: Cart =
        await this.adapters.commercetoolsProductClient.checkCartHasChanged(
          cartWithDiscount
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

      return await attachPackageToCart(iCartWithBenefit, updatedCart);
    } catch (error: any) {
      console.log('error', error);

      if (error.status && error.message) {
        throw error;
      }

      throw createStandardizedError(error, 'addItem');
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

      let updatedCart =
        await this.adapters.commercetoolsCartClient.emptyCart(cart);

      // const customerSession = await this.adapters.talonOneIntegrationAdapter.getCustomerSession(updatedCart.id);

      // if (updatedCart.lineItems.length === 0) {
      //     updatedCart = await this.couponService.clearAllCoupons(updatedCart, customerSession);
      // }

      // updatedCart = await this.adapters.commercetoolsMeCartClient.resetCartItemProductGroup(updatedCart)

      let iCartWithBenefit =
        await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(
          updatedCart
        );
      // iCartWithBenefit = updateCartFlag(iCartWithBenefit)

      return await attachPackageToCart(iCartWithBenefit, updatedCart);
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
      const {
        package: packageInfo,
        productId,
        sku,
        quantity,
        productType,
      } = value;

      const journey = cart.custom?.fields?.journey as CART_JOURNEYS;

      if (!packageInfo) {
        throw {
          statusCode: HTTP_STATUSES.BAD_REQUEST,
          statusMessage: `"package" field is missing for the cart journey ${journey}`,
        };
      }

      await InventoryValidator.validateLineItemReplaceQty(
        cart,
        sku,
        quantity,
        journey
      );

      const product = await this.getProductById(productId);
      const variant = this.getVariantBySku(product, sku);

      this.validateReleaseDate(variant.attributes!, now);
      this.validateStatus(variant);
      const cartQuantity = this.getItemQuantityBySku(cart, sku);
      const deltaQuantity = quantity - cartQuantity;

      if (deltaQuantity > 0) {
        this.validateQuantity(
          productType,
          cart,
          sku,
          product,
          variant,
          deltaQuantity
        );
      }

      const ctCartWithChanged: Cart =
        await this.adapters.commercetoolsProductClient.checkCartHasChanged(
          cart
        );
      const { ctCart: cartWithUpdatedPrice, compared } =
        await this.adapters.commercetoolsCartClient.updateCartWithNewValue(
          ctCartWithChanged
        );
      const updateCartWithOperator =
        await this.adapters.commercetoolsCartClient.updateCartWithOperator(
          cartWithUpdatedPrice,
          body.operator
        );
      const iCartWithBenefit =
        await this.adapters.commercetoolsMeCartClient.updateCartWithBenefit(
          updateCartWithOperator
        );

      return await attachPackageToCart(iCartWithBenefit, cart);
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
        const {
          package: packageInfo,
          sku,
          productType,
          productGroup,
          selected,
        } = item;

        if (!packageInfo) {
          throw {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            statusMessage: 'Validation failed',
            data: '"package" field is missing',
          };
        }

        const lineItem = cart.lineItems.find((lineItem: any) => {
          return (
            lineItem.variant.sku === sku &&
            // && lineItem.custom?.fields?.productGroup == productGroup
            lineItem.custom?.fields?.productType === productType
          );
        });
        const packageItem = cart.lineItems.find((lineItem: any) => {
          return lineItem.variant.attributes.some(
            (attribute: any) =>
              attribute.name === 'package_code' &&
              attribute.value === packageInfo.code
          );
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

      return await attachPackageToCart(iCartWithBenefit, updatedCart);
    } catch (error: any) {
      if (error.status && error.message) {
        throw error;
      }

      throw createStandardizedError(error, 'select');
    }
  }
}
