import { Attribute, Cart, CartUpdateAction, LineItem, LineItemDraft, MyCartUpdateAction, MyLineItemDraft, Product, ProductVariant, TypedMoney } from "@commercetools/platform-sdk";
import { HTTP_STATUSES } from "../constants/http.constant";
import { CompareRedisData, SimInfo } from "../types/share.types";
import { readConfiguration } from '../utils/config.utils';
import { LINE_ITEM_INVENTORY_MODES } from "../constants/lineItem.constant";
import { validateProductQuantity, validateProductReleaseDate, validateSkuStatus } from "../schemas/cart-item.schema";
import { validateInventory } from '../utils/cart.utils';
import { InventoryValidator } from '../validators/inventory.validator';
import { createStandardizedError } from '../utils/error.utils';
import CommercetoolsCustomObjectClient from '../adapters/ct-custom-object-client';
import CommercetoolsProductClient from "../adapters/ct-product-client";
import CommercetoolsInventoryClient from '../adapters/ct-inventory-client';

import _ from "lodash";
import { CART_JOURNEYS } from "../constants/cart.constant";

export class CartTransformer {
    comparePdpData = async (productData: any, ctCart: Cart): Promise<CompareRedisData> => {
        try {
            let isEqual = true;

            // 1. กรองเฉพาะ lineItems ที่เป็นสินค้า PDP (ไม่ใช่ bundle หรือ sim)
            const productItems = ctCart.lineItems.filter(
                (lineItem) =>
                    lineItem.custom?.fields?.productType !== 'bundle' &&
                    lineItem.custom?.fields?.productType !== 'sim'
            );
            const productList = Object.values(productData);
            // 2. สร้างโครงข้อมูล map ของ cart items
            const cartItemMap = productItems.map((item) => ({
                id: item.id,
                productId: item.productId,
                sku: item.variant.sku,
                quantity: item.quantity,
                externalPrice: item.price.value,
            }));

            // 3. ค้นหาสินค้าที่ต้อง "เพิ่มใหม่" (อยู่ใน Redis แต่ไม่มีใน cart)
            const addNewItem = productList.filter(
                (redisItem: any) =>
                    !cartItemMap.find(
                        (cartItem) =>
                            cartItem.productId === redisItem.productId &&
                            cartItem.sku === redisItem.sku
                    )
            );

            // 4. ค้นหาสินค้าที่ต้อง "ลบออก" (อยู่ใน cart แต่ไม่มีใน Redis)
            const removeItem = cartItemMap.filter(
                (cartItem) =>
                    !productList.find(
                        (redisItem: any) =>
                            redisItem.productId === cartItem.productId &&
                            redisItem.sku === cartItem.sku
                    )
            );

            // 5. ค้นหาสินค้าที่ต้อง "อัปเดตจำนวน" (มีทั้งคู่ แต่ quantity ไม่ตรงกัน)
            const updateQuantity = productList
                .map((redisItem: any) => {
                    const match = cartItemMap.find(
                        (cartItem) =>
                            cartItem.productId === redisItem.productId &&
                            cartItem.sku === redisItem.sku
                    );
                    if (match && match.quantity !== redisItem.quantity) {
                        return {
                            id: match.id,
                            productId: redisItem.productId,
                            sku: redisItem.sku,
                            oldQuantity: match.quantity,
                            newQuantity: redisItem.quantity,
                            externalPrice: match.externalPrice
                        };
                    }
                    return null;
                })
                .filter((x): x is { id: string, productId: string; sku: string; oldQuantity: number; newQuantity: number; externalPrice: TypedMoney } => x !== null);

            if (addNewItem.length > 0 || removeItem.length > 0 || updateQuantity.length > 0) {
                isEqual = false;
            }
            return { isEqual: isEqual, dataChange: { data: { addNewItem, removeItem, updateQuantity }, lineItems: productItems } }
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'comparePdpData');
        }
    };
    compareSelectNumberData = async (selectNumber: any, ctCart: Cart): Promise<CompareRedisData> => {
        try {
            // Find lineItems sim
            const sim = ctCart.lineItems.filter((lineItem) => lineItem.custom?.fields?.productType === 'sim');

            // Get simInfo
            const simInfoRaw = sim[0]?.custom?.fields?.simInfo;
            if (!simInfoRaw) {
                console.warn('SimInfo is missing');
                return { isEqual: false, dataChange: selectNumber };
            }

            let simInfoParsed;
            try {
                simInfoParsed = JSON.parse(simInfoRaw);
            } catch (error) {
                console.error('Invalid simInfo JSON:', error);
                return { isEqual: false, dataChange: selectNumber };
            }

            // Compare data
            const isEqual = selectNumber.sku === simInfoParsed.sku && selectNumber.msisdn === simInfoParsed.number;

            const dataChange = isEqual ? null : selectNumber;
            return { isEqual, dataChange: { data: selectNumber, lineItems: sim } };
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareSelectNumberData');
        }
    };
    compareVerificationData = async (data: any, ctCart: Cart): Promise<CompareRedisData> => {
        try {
            // Improve the function that compares Redis data and Verify information in the cart.
            const isEqual = true;
            return { isEqual: isEqual, dataChange: {} }
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareVerificationData');
        }
    };
    compareConsentData = async (data: any, ctCart: Cart) => {
        try {
            // Improve the function that compares Redis data and Consent information in the cart.
            const isEqual = true;
            return { isEqual: isEqual, dataChange: {} }
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareConsentData');
        }
    };

    compareOfferData = async (offerPackage: any, ctCart: Cart): Promise<CompareRedisData> => {
        try {
            const packageInfo = ctCart.lineItems.filter((lineItem) => lineItem.custom?.fields?.productType == 'bundle')
            // ตรวจสอบว่ามี packageInfo
            const pkgItem = packageInfo[0];
            if (!pkgItem || !pkgItem.variant?.sku) {
                console.warn('PackageInfo is missing or incomplete');
                return { isEqual: false, dataChange: offerPackage };
            }

            const skuFromVariant = pkgItem.variant.sku;
            const codeFromOffer = offerPackage.packageInfo?.packageCode;

            const isEqual = skuFromVariant === codeFromOffer;
            const dataChange = isEqual ? null : offerPackage;
            return { isEqual, dataChange: { data: offerPackage, lineItems: packageInfo } };
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareOfferData');
        }
    };

    compareEkycData = async (data: any, ctCart: Cart) => {
        try {
            // Improve the function that compares Redis data and eKYC information in the cart.
            const isEqual = true;
            return { isEqual: isEqual, dataChange: {} }
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareEkycData');
        }
    };

    compareBillingInfoAddressData = async (billingAddress: any, ctCart: Cart): Promise<CompareRedisData> => {
        try {
            const address = await transformAddress(billingAddress);

            const billingAddressInfo = ctCart?.custom?.fields?.billingAddress;
            if (!billingAddressInfo) return { isEqual: false, dataChange: address };

            const existingObject = await CommercetoolsCustomObjectClient.getCustomObjectByContainerAndKey('billing-address-info', `billing-address-${ctCart.id}`)
            if (!existingObject) return { isEqual: false, dataChange: address };

            const addressValue = existingObject.value;
            let isEqual = true;
            for (const key in address) {
                if (Object.prototype.hasOwnProperty.call(address, key)) {
                    // key is string, cast it to keyof typeof address
                    const typedKey = key as keyof typeof address;
                    if (addressValue[typedKey] !== address[typedKey]) {
                        isEqual = false;
                        break;
                    }
                }
            }

            return { isEqual, dataChange: { data: billingAddress } };
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareBillingInfoAddressData');
        }
    };

    updatePdpData = async (dataChange: any, ctCart: Cart) => {
        try {
            const updateActions: MyCartUpdateAction[] = []
            if (dataChange.data.removeItem.length > 0) {
                updateActions.push(
                    ...dataChange.data.removeItem.map((lineItem: any) => ({
                        action: 'removeLineItem',
                        lineItemId: lineItem.id,
                    }))
                );
            }

            if (dataChange.data.addNewItem.length > 0) {
                const journey = ctCart.custom?.fields?.journey as CART_JOURNEYS;
                const myUpdateAction = dataChange.data.addNewItem.map(async (item: any) => {
                    await InventoryValidator.validateLineItemUpsert(
                        ctCart,
                        item.sku,
                        item.quantity,
                        journey
                    );

                    const product = await getProductById(item.productId);
                    const variant = getVariantBySku(product, item.sku);
                    const now = new Date();
                    const validPrice = getValidPrice(variant, now);
                    validateReleaseDate(variant.attributes!, now);
                    validateStatus(variant);
                    validateQuantity(
                        item.productType,
                        ctCart,
                        item.sku,
                        product,
                        variant,
                        item.quantity
                    );

                    return {
                        action: 'addLineItem',
                        productId: item.productId,
                        variantId: variant.id,
                        quantity: item.quantity,
                        price: validPrice,
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
                                productType: item.productType,
                                productGroup: item.productGroup,
                                selected: false,
                                isPreOrder: false,
                                journey,
                            },
                        },
                    } as MyCartUpdateAction;
                });
                const addActions = await Promise.all(myUpdateAction);
                updateActions.push(...addActions);
            }

            if (dataChange.data.updateQuantity.length > 0) {
                updateActions.push(
                    ...dataChange.data.updateQuantity.map((lineItem: any) => ({
                        action: 'changeLineItemQuantity',
                        lineItemId: lineItem.id,
                        quantity: lineItem.newQuantity,
                        externalPrice: lineItem.externalPrice
                    }))
                );
            }
            return updateActions;
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareBillingInfoAddressData');
        }
    }

    updateSelectNumberData = async (dataChange: any, correlationid: string, ctCart: Cart) => {
        try {
            const lineItem = dataChange.lineItems;
            if (lineItem.length == 0) return [];
            const sim = await getSimBySku(dataChange.data.sku);
            if (!sim) return [];

            const simInfo = getSimInfo(dataChange.data, correlationid)
            if (!simInfo) return [];

            const lineItemDraft: LineItemDraft = {
                productId: sim[0].id,
                variantId: sim[1].id,
                quantity: 1,
                supplyChannel: {
                    typeId: 'channel',
                    id: readConfiguration().ctpSupplyChannel,
                },
                inventoryMode: selectSimInventoryMode(sim[1]),
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
                        simInfo: [JSON.stringify(simInfo)]
                    },
                },
            }

            const updateActions: MyCartUpdateAction[] = [
                {
                    action: 'removeLineItem',
                    lineItemId: lineItem[0].id,
                },
                {
                    action: 'addLineItem',
                    ...lineItemDraft,
                }
            ];

            return updateActions;
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareBillingInfoAddressData');
        }
    }

    updateOfferData = async (dataChange: any, ctCart: Cart) => {
        try {
            const packageInfo = dataChange.lineItems;
            if (packageInfo.length == 0) return []

            const code = dataChange.data.packageInfo?.packageCode;
            if (!code) return [];

            const mainPackage =
                await CommercetoolsProductClient.queryProducts({
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

            const packageCode = mainPackage?.results[0]?.masterData?.current?.masterVariant?.attributes?.find(
                (attr) => attr.name === 'package_code'
            );
            const packageName = mainPackage?.results[0]?.masterData?.current?.masterVariant?.attributes?.find(
                (attr) => attr.name === 'package_name'
            );
            const priceplanRc = mainPackage?.results[0]?.masterData?.current?.masterVariant?.attributes?.find(
                (attr) => attr.name === 'priceplan_rc'
            );

            const packageCustomObj = await CommercetoolsCustomObjectClient.createOrUpdateCustomObject(
                {
                    container: 'package-info',
                    key: `pkg-${ctCart.id}`,
                    value: {
                        package_code: packageCode?.value,
                        name: packageName?.value,
                        t1: {
                            priceplanRcc: priceplanRc?.value,
                            penalty: 1_000_000,
                            advancedPayment: 42000,
                            extraAdvancedPayment: dataChange.data.verifyCheck.extraAdvancePayment * 100,
                            contractTerm: dataChange.data.packageInfo.contractTerm,
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

            if (!packageCustomObj) return [];

            const lineItemDraft: LineItemDraft = {
                productId: mainPackage?.results[0]?.id,
                variantId: mainPackage?.results[0]?.masterData.current.masterVariant.id,
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
                }
            }

            const updateActions: MyCartUpdateAction[] = [
                {
                    action: 'removeLineItem',
                    lineItemId: packageInfo[0].id,
                },
                {
                    action: 'addLineItem',
                    ...lineItemDraft,
                },
                {
                    action: 'setCustomField',
                    name: 'packageAdditionalInfo',
                    value: {
                        typeId: 'key-value-document',
                        id: packageCustomObj.id,
                    },
                }
            ];

            return updateActions;
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareBillingInfoAddressData');
        }
    }

    updateBillingInfoAddressData = async (dataChange: any, ctCart: Cart) => {
        try {
            const billingAddressInfo = await CommercetoolsCustomObjectClient.createOrUpdateCustomObject(
                {
                    container: 'billing-address-info',
                    key: `billing-address-${ctCart.id}`,
                    value: transformAddress(dataChange.data.billingAddress)
                }
            );

            if (!billingAddressInfo) return [];

            const updateActions: MyCartUpdateAction[] = [
                {
                    action: 'setCustomField',
                    name: 'billingAddress',
                    value: {
                        typeId: 'key-value-document',
                        id: billingAddressInfo.id,
                    },
                }
            ];

            return updateActions;
        } catch (error: any) {
            console.log('error', error);

            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'compareBillingInfoAddressData');
        }
    }
}

const transformAddress = async (address: Record<string, any>) => {
    const separator = address.locale === 'en' ? ', ' : ' ';
    const output = {
        firstName: address.firstName,
        lastName: address.lastName,
        custom_houseNo: address.houseNo,
        custom_moo: address.moo,
        custom_village: address.village,
        building: address.building,
        custom_floor: address.floor,
        custom_roomNo: address.roomNo,
        custom_soi: address.roomNo,
        streetName: address.streetName,
        phone: address.phone,
        email: address.email,
        custom_smartSearch: [address.subDistrict, address.city, address.state, address.postalCode].join(separator),
    };

    return output;
};


const getSimBySku = async (sku: string): Promise<[Product, ProductVariant]> => {
    const sim = await CommercetoolsProductClient.queryProducts({
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
            sim.results[0].masterData.current?.masterVariant?.attributes?.find(
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
        return [simProduct, simProduct.masterData?.current?.variants?.find((variant: ProductVariant) => variant.sku === sku)!]
    }
}

const selectSimInventoryMode = (variant: ProductVariant): LINE_ITEM_INVENTORY_MODES => {
    return variant.attributes?.find(
        (attr: Attribute) => attr.name === 'sim_source_type'
    )?.value.some(({ key }: any) => key === 'e_sim')
        ? LINE_ITEM_INVENTORY_MODES.NONE
        : LINE_ITEM_INVENTORY_MODES.RESERVE_ON_ORDER
}

const getSimInfo = (sim: Record<string, any>, correlationid: string | undefined | null): SimInfo => {
    const simInfo: SimInfo = {
        sku: sim.sku,
        number: sim.msisdn,
        simType: sim.simSourceType,
        groupNumber: sim.numberType === 'normal'
            ? {
                'th-TH': 'ประเภทเบอร์ทั่วไป',
                'en-US': 'General number',
            }
            : {
                'th-TH': 'ประเภทเบอร์มงคล',
                'en-US': 'Blessed number',
            },
        correlatorId: correlationid,
        selectNumberCreateAt: sim.createAt,
    };
    return simInfo;
};

const validateReleaseDate = (attributes: any[], today: Date) => {
    const isValidReleaseDate = validateProductReleaseDate(attributes, today);

    if (!isValidReleaseDate) {
        throw {
            statusCode: HTTP_STATUSES.NOT_FOUND,
            statusMessage: 'Product release date is not in period',
        };
    }
}

const validateStatus = (variant: ProductVariant): void => {
    validateSkuStatus(variant.attributes!);
}


const validateQuantity = (
    productType: string,
    cart: Cart,
    sku: string,
    product: Product,
    variant: ProductVariant,
    deltaQuantity: number
) => {
    const cartQuantity = getItemQuantityBySku(cart, sku);

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
const getItemQuantityBySku = (cart: Cart, sku: string) => {
    return cart.lineItems
        .filter((item: LineItem) => item.variant.sku === sku)
        .reduce((sum, item) => sum + item.quantity, 0);
}

const getInventories = async (skus: string) => {
    const inventories =
        await CommercetoolsInventoryClient.getInventory(skus);
    if (inventories.length === 0) {
        throw {
            statusCode: HTTP_STATUSES.NOT_FOUND,
            statusMessage: 'Inventory not found',
        };
    }

    return inventories;
}

const checkValidateInventory = (inventory: any): any => {
    const { isDummyStock, isOutOfStock } = validateInventory(inventory);

    if (isOutOfStock && !isDummyStock) {
        throw {
            statusCode: HTTP_STATUSES.BAD_REQUEST,
            statusMessage: 'Insufficient stock for the requested quantity',
        };
    }

    return { isDummyStock, isOutOfStock };
}

const getProductById = async (id: string): Promise<Product> => {
    const product =
        await CommercetoolsProductClient.getProductById(id)
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

const getVariantBySku = (product: Product, sku: string): ProductVariant => {
    const variant = CommercetoolsProductClient.findVariantBySku(
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


const getValidPrice = (variant: ProductVariant, today: Date) => {
    const validPrice = CommercetoolsProductClient.findValidPrice({
        prices: variant.prices!,
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