import {
  Cart,
  LineItem,
  MyCartUpdateAction,
  Product,
  ProductVariant,
  Attribute,
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
import _, { update } from 'lodash';
import { attachPackageToCart, attachSimToCart } from '../helpers/cart.helper';

export class DeviceBundleNewCartStrategy extends BaseCartStrategy {
  constructor() {
    super(
      CommercetoolsProductClient,
      CommercetoolsCartClient,
      CommercetoolsInventoryClient,
      CommercetoolsCustomObjectClient
      // TalonOneEffectConverter,
      // TalonOneIntegrationAdapter
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

  protected async getSimBySku(sku: string): Promise<[Product, ProductVariant]> {
    const sim = await this.adapters.commercetoolsProductClient.queryProducts({
      where: `masterData(current(masterVariant(sku="${sku}"))) or masterData(current(variants(sku="${sku}")))`,
    });

    if (!sim.results.length) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'SIM not found',
      };
    }

    if (
      !sim.results[0].masterData.published ||
      _.isEmpty(
        sim.results[0].masterData.current.masterVariant.attributes.find(
          (attr: Attribute) =>
            attr.name === 'status' && attr.value.key === 'enabled'
        )
      )
    ) {
      throw {
        statusCode: HTTP_STATUSES.NOT_FOUND,
        statusMessage: 'SIM is no longer available.',
      };
    }

    const simProduct = sim.results[0];

    if (simProduct.masterData.current.masterVariant.sku === sku) {
      return [simProduct, simProduct.masterData.current.masterVariant]
    } else {
      return [simProduct, simProduct.masterData.current.variants.find((variant: ProductVariant) => variant.sku === sku)]
    }
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

  protected getValidPrice(variant: ProductVariant, today: Date) {
    const validPrice = this.adapters.commercetoolsProductClient.findValidPrice({
      prices: variant.prices,
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
    mainPackage: ProductVariant
  ): Promise<any> {
    const packageCode = mainPackage.attributes?.find(
      (attr) => attr.name === 'package_code'
    );
    const packageName = mainPackage.attributes?.find(
      (attr) => attr.name === 'package_name'
    );
    const priceplanRc = mainPackage.attributes?.find(
      (attr) => attr.name === 'priceplan_rc'
    );

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
              penalty: 1_000_000,
              advancedPayment: 42000,
              extraAdvancedPayment: 11000,
              contractTerm: 12,
            },
            connector: {
              description: {
                'en-US':
                  'Monthly fee 1,299 12-month \n contract Package fee will be charged on the invoice \n Early cancellation penalty 10,000 THB',
                'th-TH':
                  'ค่าบริการราย 1,299 สัญญา 12 เดือน \n ค่าแพ็คเกจ รายเดือนจะเรียกเก็บในใบแจ้งค่าบริการ \n ค่าปรับกรณียกเลิกสัญญาก่อนกำหนด 10,000 บาท',
              },
            },
          },
        }
      );

    return packageCustomObj;
  }

  protected async getBillingAddressInfo(
    cart: Cart,
    billingAddress: any
  ): Promise<any> {
    const packageCustomObj =
      await this.adapters.commercetoolsCustomObjectClient.createOrUpdateCustomObject(
        {
          container: 'billing-address-info',
          key: `billing-address-${cart.id}`,
          value: billingAddress
        }
      );

    return packageCustomObj;
  }


  protected validateDeviceBundleNew(
    body: any,
    cart: Cart,
    variant: ProductVariant
  ) {
    const { package: mainPackage, sim: simInfo, billingAddress } = body;

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
          '"package.code" is required for journey "device_bundle_new"',
      };
    }

    if (_.isEmpty(simInfo)) {
      throw {
        statusCode: HTTP_STATUSES.BAD_REQUEST,
        statusMessage: '"sim.sku" is required for journey "device_bundle_new"',
      };
    }

    if (_.isEmpty(billingAddress)) {
      throw {
        statusCode: HTTP_STATUSES.BAD_REQUEST,
        statusMessage: '"billingAddress" is required for journey "device_bundle_new"',
      };
    }

    if (
      !variant.attributes?.some(
        (value) =>
          value.name === 'journey' &&
          value.value.some(
            (journey: any) => journey.key === CART_JOURNEYS.DEVICE_BUNDLE_NEW
          )
      )
    ) {
      throw {
        statusCode: HTTP_STATUSES.BAD_REQUEST,
        statusMessage: `Cannot add a non-"device_bundle_new" item to a "device_bundle_new" cart.`,
      };
    }
  }

  private selectSimInventoryMode(variant: ProductVariant): LINE_ITEM_INVENTORY_MODES {
    return variant.attributes?.find(
      (attr: Attribute) => attr.name === 'sim_source_type'
    )?.value.some(({key}:any) => key === 'e_sim')
      ? LINE_ITEM_INVENTORY_MODES.NONE
      : LINE_ITEM_INVENTORY_MODES.RESERVE_ON_ORDER
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
      const {
        package: packageInfo,
        sim: simInfo,
        billingAddress,
        productId,
        sku,
        quantity,
        productType,
        productGroup,
      } = payload;
      const journey = cart.custom?.fields?.journey as CART_JOURNEYS;

      await InventoryValidator.validateLineItemUpsert(
        cart,
        sku,
        quantity,
        journey,
        payload.campaignVerifyValues && payload.campaignVerifyValues.length > 0
      );

      const product = await this.getProductById(productId);
      const variant = this.getVariantBySku(product, sku);
      this.validateDeviceBundleNew(payload, cart, variant);
      const validPrice = this.getValidPrice(variant, now);
      const mainPackage = await this.getPackageByCode(packageInfo.code);
      const sim = await this.getSimBySku(simInfo.sku);
      const packageAdditionalInfo = await this.getPackageAdditionalInfo(
        cart,
        mainPackage.masterData.current.masterVariant
      );
      const billingAddressInfo = await this.getBillingAddressInfo(cart, billingAddress)
      this.validateReleaseDate(variant.attributes!, now);
      this.validateStatus(variant);
      this.validateQuantity(productType, cart, sku, product, variant, quantity);

      const inventories = await this.getInventories(sku);
      const inventory = inventories[0];

      const { isDummyStock } = this.validateInventory(inventory);

      const newProductGroup = this.calculateProductGroup({
        cart,
        productId,
        sku,
        productType,
        productGroup,
      });

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
                  productType: 'bundle',
                  selected: false,
                },
              },
            },
            {
              action: 'addLineItem',
              productId: sim[0].id,
              variantId: sim[1].id,
              quantity: 1,
              inventoryMode: this.selectSimInventoryMode(sim[1]),
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
                  productType: 'sim',
                  selected: false,
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
                centAmount: 420000,
              },
              slug: 'advance-payment',
              taxCategory: {
                typeId: 'tax-category',
                id: readConfiguration().ctpTaxCategoryId,
              },
            },
            {
              action: 'addCustomLineItem',
              name: {
                'en-US': 'Extra Advanced Payment',
                'th-TH': 'ค่าบริการล่วงหน้าเพิ่มเติม',
              },
              quantity: 1,
              money: {
                currencyCode: 'THB',
                centAmount: 110000,
              },
              slug: 'extra-advance-payment',
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
              action: 'setCustomField',
              name: 'billingAddress',
              value: {
                typeId: 'key-value-document',
                id: billingAddressInfo.id,
              },
            },
          ]
        );
      // let iCart: ICart = this.adapters.commercetoolsMeCartClient.mapCartToICart(updatedCart);
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

      const icart = await attachPackageToCart(iCartWithBenefit, updatedCart);
      return attachSimToCart(icart, updatedCart)
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

      const icart = await attachPackageToCart(iCartWithBenefit, updatedCart);
      return attachSimToCart(icart, updatedCart)
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

        const icart = await attachPackageToCart(iCartWithBenefit, cart);
        return attachSimToCart(icart, cart)
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
          sim: simInfo,
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

        if (!simInfo) {
          throw {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            statusMessage: 'Validation failed',
            data: '"sim" field is missing',
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
        const simItem = cart.lineItems.find((lineItem: any) => {
          return lineItem.variant.sku === sku
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
            statusMessage: `Line item with Package Code ${packageInfo.code} not found in the cart.`,
          };
        }
        if (!simItem) {
          throw {
            statusCode: HTTP_STATUSES.NOT_FOUND,
            statusMessage: `Line item with SIM ${simInfo.sku} not found in the cart.`,
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

        updateActions.push({
          action: 'setLineItemCustomField',
          lineItemId: simItem.id,
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

        const icart = await attachPackageToCart(iCartWithBenefit, updatedCart);
        return attachSimToCart(icart, updatedCart)
    } catch (error: any) {
      if (error.status && error.message) {
        throw error;
      }

      throw createStandardizedError(error, 'select');
    }
  }
}
