// cart/src/services/cart.service.ts

import _ from 'lodash'
import { Cart, CartUpdateAction } from '@commercetools/platform-sdk';
import CommercetoolsMeCartClient from '../adapters/me/ct-me-cart-client';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';
import CommercetoolsCartClient from '../adapters/ct-cart-client';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import { talonOneEffectConverter } from '../adapters/talon-one-effect-converter'
import { ICart } from '../interfaces/cart';
import { validateCartCheckoutBody, validateCreateAnonymousCartBody } from '../validators/cart.validator';
import { TalonOneCouponAdapter } from '../adapters/talon-one-coupon.adapter';
import { validateProductQuantity } from '../validators/cart-item.validator';
import ApigeeClientAdapter from '../adapters/apigee-client.adapter';
import TsmOrderModel from '../models/tsm-order.model';
import { readConfiguration } from '../utils/config.utils';
import { EXCEPTION_MESSAGES } from '../utils/messages.utils';
import { BlacklistService } from './blacklist.service'
import { safelyParse } from '../utils/response.utils';
import { commercetoolsOrderClient } from '../adapters/ct-order-client';
import { logger } from '../utils/logger.utils';
import { CART_JOURNEYS, journeyConfigMap } from '../constants/cart.constant';

export class CartService {
    private talonOneCouponAdapter: TalonOneCouponAdapter;
    private blacklistService: BlacklistService
    private talonOneEffectConverter: typeof talonOneEffectConverter

    constructor() {
        this.talonOneCouponAdapter = new TalonOneCouponAdapter();
        this.talonOneEffectConverter = talonOneEffectConverter
        this.blacklistService = new BlacklistService()
    }

    public updateStockAllocation = async (ctCart: Cart): Promise<void> => {
        try {
            const journey = ctCart.custom?.fields?.journey as CART_JOURNEYS;
            const journeyConfig = journeyConfigMap[journey];

            for (const lineItem of ctCart.lineItems) {
                const supplyChannel = lineItem.supplyChannel;
                if (!supplyChannel || !supplyChannel.id) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Supply channel is missing on line item.',
                        errorCode: "SUPPLY_CHANNEL_MISSING",
                    };
                }

                const inventoryId =
                    lineItem.variant.availability?.channels?.[supplyChannel.id]?.id;
                if (!inventoryId) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'InventoryId not found.',
                        errorCode: "INVENTORY_ID_NOT_FOUND",
                    };
                }

                const inventoryEntry = await CommercetoolsInventoryClient.getInventoryById(inventoryId);
                if (!inventoryEntry) {
                    throw {
                        statusCode: 400,
                        statusMessage: `Inventory entry not found for ID: ${inventoryId}`,
                        errorCode: "INVENTORY_ENTRY_NOT_FOUND",
                    };
                }

                const orderedQuantity = lineItem.quantity;
                await CommercetoolsInventoryClient.updateInventoryAllocationV2(
                    inventoryEntry,
                    orderedQuantity,
                    journey,
                    journeyConfig
                );
            }
        } catch (error) {
            throw {
                statusCode: 400,
                statusMessage: `Update stock allocation failed.`,
                errorCode: "CREATE_ORDER_ON_CT_FAILED",
            };
        }
    };

    public createOrder = async (accessToken: any, payload: any, partailValidateList: any[] = []): Promise<any> => {
        const defaultValidateList = [
            'BLACKLIST',
            'CAMPAIGN',
        ]

        let validateList = defaultValidateList
        if (partailValidateList.length) {
            validateList = partailValidateList
        }

        const { cartId } = payload
        const ctCart = await this.getCtCartById(accessToken, cartId)

        // * STEP #2 - Validate Blacklist
        if (validateList.includes('BLACKLIST')) {
            await this.validateBlacklist(ctCart)
        }

        // * STEP #3 - Validate Campaign & Promotion Set
        if (validateList.includes('CAMPAIGN')) {
            await this.validateCampaign(ctCart)
        }

        // * STEP #4 - Validate Available Quantity (Commercetools)
        await this.validateAvailableQuantity(ctCart)

        const orderNumber = this.generateOrderNumber()

        // * STEP #5 - Create Order On TSM Sale
        const { success, response } = await this.createTSMSaleOrder(orderNumber, ctCart)
        // //! IF available > x
        // //! THEN continue
        // //! ELSE
        // //! THEN throw error

        const tsmSaveOrder = {
            tsmOrderIsSaved: success,
            tsmOrderResponse: typeof response === 'string' ? response : JSON.stringify(response)
        }

        await this.updateStockAllocation(ctCart);
        const order = await commercetoolsOrderClient.createOrderFromCart(orderNumber, ctCart, tsmSaveOrder);

        return order;
    };

    public checkout = async (accessToken: string, id: string, body: any): Promise<any> => {
        const { error, value } = validateCartCheckoutBody(body);
        if (error) {
            throw {
                statusCode: 400,
                statusMessage: 'Validation failed',
                data: error.details.map((err) => err.message),
            };
        }

        const { shippingAddress, billingAddress, shippingMethodId, payment } = value;

        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

        const cart = await commercetoolsMeCartClient.getCartById(id);
        if (!cart) {
            throw {
                statusCode: 404,
                statusMessage: 'Cart not found or has expired',
            };
        }

        

        const profileId = cart?.id

     

        const updateActions: CartUpdateAction[] = [];

        if (shippingAddress) {
            updateActions.push({
                action: 'setShippingAddress',
                address: shippingAddress,
            });
        }

        if (billingAddress) {
            updateActions.push({
                action: 'setBillingAddress',
                address: billingAddress,
            });
        }

        if (shippingMethodId) {
            updateActions.push({
                action: 'setShippingMethod',
                shippingMethod: {
                    typeId: 'shipping-method',
                    id: shippingMethodId,
                },
            });
        }

        if (payment && (payment.source || payment.token)) {
            const paymentTransaction = {
                paymentOptionContainer: 'paymentOptions',
                paymentOptionKey: payment.key, // e.g., 'installment', 'ccw', etc.
                source: payment.source || null,
                token: payment.token || null,
                createdAt: new Date().toISOString(),
            };

            await CommercetoolsCustomObjectClient.addPaymentTransaction(cart.id, paymentTransaction);
        }

        // console.log('talonOneUpdateActions', talonOneUpdateActions)

        // updateActions.push(...talonOneUpdateActions);

        const updatedCart = await CommercetoolsCartClient.updateCart(
            cart.id,
            cart.version,
            updateActions,
        );

        // TODO : CHECK LOGIC
        // * Implement done response include itemHasChanged
        const cartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(updatedCart)

        const coupons = await this.talonOneCouponAdapter.getEffectsCouponsById(profileId, updatedCart.lineItems);

        let iCart: ICart = commercetoolsMeCartClient.mapCartToICart(cartWithChanged);
        iCart = commercetoolsMeCartClient.mapCartChangedToICart(iCart, cartWithChanged)

        return { ...iCart, ...coupons };
    };

    public createAnonymousCart = async (accessToken: string, body: any) => {
        const { campaignGroup, journey } = body;

        const { error } = validateCreateAnonymousCartBody({ campaignGroup, journey });
        if (error) {
            throw {
                statusCode: 400,
                statusMessage: 'Validation failed',
                data: error.details.map((err: any) => err.message),
            };
        }

        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

        const cart = await commercetoolsMeCartClient.createCart(campaignGroup, journey);

        const iCart: ICart = commercetoolsMeCartClient.mapCartToICart(cart);

        return iCart;
    }

    public getCartById = async (accessToken: string, id: string, selectedOnly: boolean): Promise<any> => {
        if (!id) {
            throw {
                statusCode: 400,
                statusMessage: 'Cart ID is required',
            };
        }

        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);
        const ctCart = await commercetoolsMeCartClient.getCartById(id);
        if (!ctCart) {
            throw {
                statusCode: 404,
                statusMessage: 'Cart not found or has expired',
            };
        }
        const ctCartWithChanged = await CommercetoolsProductClient.checkCartHasChanged(ctCart)
        const iCartWithBenefit = await commercetoolsMeCartClient.getCartWithBenefit(ctCartWithChanged, selectedOnly);
        const coupons  = await this.talonOneCouponAdapter.getEffectsCouponsById(id, ctCartWithChanged.lineItems);
        return {  ...iCartWithBenefit, ...coupons };
    };

    public getCtCartById = async (accessToken: string, id: string): Promise<any> => {
        if (!id) {
            throw {
                statusCode: 400,
                statusMessage: 'Cart ID is required',
            };
        }

        const commercetoolsMeCartClient = new CommercetoolsMeCartClient(accessToken);

        const ctCart = await commercetoolsMeCartClient.getCartById(id);
        
        if (!ctCart) {
            throw {
                statusCode: 404,
                statusMessage: 'Cart not found or has expired',
            };
        }

        return ctCart
    };

    private createTSMSaleOrder = async (orderNumber: string, cart: any) => {
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter
            const config = readConfiguration()
            const tsmOrder = new TsmOrderModel({ ctCart: cart, config, orderNumber })
            const tsmOrderPayload = tsmOrder.toPayload()

            logger.info(`tsmOrderPayload: ${JSON.stringify(tsmOrderPayload)}`)
            const response = await apigeeClientAdapter.saveOrderOnline(tsmOrderPayload)

            const { code } = response || {}

            // if (code !== '0') {
            //     throw {
            //         statusCode: 400,
            //         statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
            //         errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED'
            //     };
            // }

            return {
                success: code === '0',
                response
            }

        } catch (error: any) {
            logger.info(`createTSMSaleOrder-error: ${JSON.stringify(error)}`)
            let data = error?.response?.data
            if (data) {
                data = safelyParse(data)
            }
            // throw {
            //     statusCode: 400,
            //     statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
            //     errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED',
            //     ...(data ? { data } : {})
            // };
            return {
                success: false,
                response: data
            }
        }
    }

    private async validateBlacklist(ctCart: any) {
        try {
            // return true
            const { custom: cartCustomField, shippingAddress } = ctCart
            const journey = cartCustomField?.fields?.journey
            const body: any =
            {
                journey, /* Mandarory */
                // paymentTMNAccountNumber: '0830053853',
                // paymentCreditCardNumber: {
                //     'firstDigits': null,
                //     'lastDigits': '1234'
                // },
                // ipAddress: '127.0.0.1',
                // googleID: 'thiamkhae.pap@ascendcorp.com', //! ASK PO
                shippingAddress: {
                    city: shippingAddress.state, /* Mandarory */
                    district: shippingAddress.city, /* Mandarory */
                    postcode: shippingAddress.postalCode, /* Mandarory */
                    subDistrict: shippingAddress.custom?.fields?.subDistrict /* Mandarory */
                },
                email: shippingAddress.email, /* Mandarory */
                deliveryContactNumber: shippingAddress.phone, /* Mandarory */
                deliveryContactName: `${shippingAddress.firstName} ${shippingAddress.lastName}` /* Mandarory */
            }
            const response = await this.blacklistService.checkBlacklist(body);
            if (!response?.status) {
                throw new Error('Blacklist validation failed');
            }
        } catch (e) {
            throw {
                statusCode: 400,
                statusMessage: EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'BLACKLIST_VALIDATE_FAILED'
            };
        }
    }


    private validateMandatoryProduct(selectedLineItems: any[], selectedlineItemWithCampaignBenefits: any[]) {
        const mainProductLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'main_product')
        for (const mainProductLineItem of mainProductLineItems) {
            const sku = mainProductLineItem.variant.sku;
            const productType = mainProductLineItem?.custom?.fields?.productType;
            const productGroup = mainProductLineItem?.custom?.fields?.productGroup;

            let privilege = mainProductLineItem?.custom?.fields?.privilege;
            privilege = privilege ? JSON.parse(privilege) : null;

            const selectedlineItemWithCampaignBenefit = selectedlineItemWithCampaignBenefits.find((item: any) => {
                return item.variant.sku === sku &&
                    item.custom.fields.productType === productType &&
                    item.custom.fields.productGroup === productGroup
            })

            const { privilege: newPrivilege } = selectedlineItemWithCampaignBenefit

            if (!_.isEqual(privilege, newPrivilege)) {
                throw new Error('Invalid main product');
            }
        }



        return true;
    }

    private validateSecondaryProduct(selectedLineItems: any[], selectedlineItemWithCampaignBenefits: any[]) {
        const mainProductLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'main_product')

        const addOnLineItems = selectedLineItems.filter((selectedLineItem: any) => selectedLineItem?.custom?.fields?.productType === 'add_on')

        let validateObject = mainProductLineItems.reduce((acc: any, mainProductLineItem: any) => {
            const sku = mainProductLineItem.variant.sku
            const productType = mainProductLineItem?.custom?.fields?.productType
            const productGroup = mainProductLineItem?.custom?.fields?.productGroup

            const selectedlineItemWithCampaignBenefit = selectedlineItemWithCampaignBenefits.find((item: any) => {
                return item.variant.sku === sku &&
                    item.custom.fields.productType === productType &&
                    item.custom.fields.productGroup === productGroup
            })

            const { availableBenefits } = selectedlineItemWithCampaignBenefit
            const groupMap = availableBenefits?.reduce(((acc: any, availableBenefit: any) => {
                const { promotionSetCode, maxReceive, group, maxItem } = availableBenefit
                if (!acc?.[promotionSetCode]) {
                    acc[promotionSetCode] = {
                        remainingMaxReceive: maxReceive,
                        remainingMaxItem: {}
                    }
                }

                acc[promotionSetCode].remainingMaxItem = {
                    ...acc[promotionSetCode].remainingMaxItem,
                    [group]: maxItem
                }

                return acc
            }), {})

            //! {
            //!     1: {
            //!         xx1234: {
            //!             remainingMaxReceive: 5,
            //!             remainingMaxItem: {
            //!                 addon1: 2,
            //!                 addon2: 2
            //!             }
            //!         }
            //!     }
            //! }
            acc[productGroup] = groupMap

            return acc
        }, {});

        validateObject = addOnLineItems.reduce((acc: any, addOnLineItem: any) => {
            const quantity = addOnLineItem.quantity;
            const productGroup = addOnLineItem?.custom?.fields?.productGroup;
            const addOnGroup = addOnLineItem?.custom?.fields?.addOnGroup;
            let privilege = addOnLineItem?.custom?.fields?.privilege;
            privilege = privilege ? JSON.parse(privilege) : null;

            if (!privilege) {
                throw new Error('Invalid add-on product');
            }

            const groupMap = acc[productGroup]

            if (!groupMap) {
                throw new Error('Invalid add-on product');
            }

            const { promotionSetCode } = privilege
            const limit = groupMap[promotionSetCode]

            if (!limit) {
                throw new Error('Invalid add-on product');
            }

            const { remainingMaxReceive, remainingMaxItem } = limit

            if (!remainingMaxItem[addOnGroup]) {
                throw new Error('Invalid add-on product');

            }

            acc[productGroup][promotionSetCode] = {
                remainingMaxReceive: remainingMaxReceive - quantity,
                remainingMaxItem: {
                    ...remainingMaxItem,
                    [addOnGroup]: remainingMaxItem[addOnGroup] - quantity
                }
            }

            return acc;
        }, validateObject);

        //! {
        //!     1: {
        //!         xx1234: {
        //!             remainingMaxReceive: 5,
        //!             remainingMaxItem: {
        //!                 addon1: 2,
        //!                 addon2: 2
        //!             }
        //!         }
        //!     }
        //! }
        // Loop through the product groups
        Object.entries(validateObject as Record<string, any>).forEach(([productGroup, groupLimits]) => {
            // Loop through the next level (e.g., xx1234)
            Object.entries(groupLimits as Record<string, any>).forEach(([levelKey, limits]) => {
                const { remainingMaxReceive, remainingMaxItem } = limits;

                // Check the remainingMaxReceive for this level
                if (remainingMaxReceive < 0) {
                    throw new Error(`Total add-on reach limit for product group "${productGroup}"`);
                }

                // Check remainingMaxItem for this level
                Object.entries(remainingMaxItem as Record<string, any>).forEach(([addOnGroup, maxItem]) => {
                    if (maxItem < 0) {
                        throw new Error(
                            `Total add-on group "${addOnGroup}" reach limit for level "${levelKey}" in product group "${productGroup}"`
                        );
                    }
                });
            });
        });

        return true;
    }

    private async validateCampaign(ctCart: any) {
        try {
            const { lineItems } = ctCart;
            const lineItemWithCampaignBenefits = await talonOneEffectConverter.getCtLineItemWithCampaignBenefits(ctCart)
            // const selectedlineItemWithCampaignBenefits = lineItemWithCampaignBenefits.filter((lineItemWithCampaignBenefit: any) => lineItemWithCampaignBenefit.custom?.fields?.selected)
            // const selectedLineItems = lineItems.filter((lineItem: any) => lineItem.custom?.fields?.selected)
            const selectedlineItemWithCampaignBenefits = lineItemWithCampaignBenefits
            const selectedLineItems = lineItems

            this.validateMandatoryProduct(selectedLineItems, selectedlineItemWithCampaignBenefits)
            this.validateSecondaryProduct(selectedLineItems, selectedlineItemWithCampaignBenefits);

            return true;
        } catch (error: any) {
            console.error('error-cartService-validateCampaign', error)
            throw {
                statusCode: 400,
                statusMessage: error?.statusMessage || error.message || EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CAMPAIGN_VALIDATE_FAILED'
            };
        }
    }

    private async validateAvailableQuantity(ctCart: Cart) {
        try {
            const { lineItems } = ctCart
            for (const lineItem of lineItems) {
                const productType = lineItem.custom?.fields?.productType;
                const sku = lineItem.variant.sku as string;
                const productId = lineItem.productId;

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

                validateProductQuantity(
                    productType,
                    ctCart,
                    sku,
                    productId,
                    variant,
                )
            }
            return true
        } catch (error: any) {
            console.error(error)
            throw {
                statusCode: 400,
                statusMessage: error?.statusMessage || error.message || EXCEPTION_MESSAGES.BAD_REQUEST,
                errorCode: 'CREATE_ORDER_ON_TSM_SALE_FAILED'
            };
        }
    }


    private generateOrderNumber() {
        const timestamp = Date.now().toString(); // Current timestamp
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // Random 4-digit number
        return `ORD-${timestamp}-${random}`; // Combine parts into an order number
    }
}