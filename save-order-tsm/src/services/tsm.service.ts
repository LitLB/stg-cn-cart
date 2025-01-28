import { readConfiguration } from "../utils/config.utils"
import { logger } from "../utils/logger.utils"
import { safelyParse } from "../utils/response.utils"
import * as apigeeService from "./apigee.service"
import { CreateTSMSaleOrderResponse, OrderPayload } from "../types/services/tsm.type"
import { LineItem, Order } from "@commercetools/platform-sdk"
import { apigeeEncrypt } from "../utils/apigeeEncrypt.utils"
import { GetCouponInformationResult } from "../types/services/commercetools.type"

export const createTSMSaleOrderPayloadFromOrder = (order: Order, couponDiscounts: any): OrderPayload => {
    const config = readConfiguration()
    const shopCode = config.tsmOrder.shopCode
    const saleCode = config.tsmOrder.saleCode
    const saleName = config.tsmOrder.saleName
    const ApigeePrivateKeyEncryption = config.apigee.privateKeyEncryption

    const orderId = order.orderNumber! // trust orderNumber is not null

    const lineItems = order.lineItems
    const shippingAddress = order.shippingAddress!
    const campaignVerifyValues = getCampaignVerifyValues(lineItems)
    const thaiId = campaignVerifyValues.find((v: any) => v.name === 'ThaiId')?.value || ''
    const encryptedThaiId = thaiId ? apigeeEncrypt(thaiId, ApigeePrivateKeyEncryption) : ''

    const customer = {
        thaiId: encryptedThaiId,
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
    }

    // TODO filter lineItems by selected 
    let sequenceCounter = 1
    const sequenceItems = lineItems.flatMap((lineItem: any) => {
        const productCode = lineItem.variant.sku
        const productGroup = lineItem.custom?.fields?.productGroup
        const productType = lineItem.custom?.fields?.productType
        let privilege = lineItem?.custom?.fields?.privilege
        privilege = privilege && JSON.parse(privilege);

        const campaignVerifyValues = getCampaignVerifyValuesFromCurrentLineItem(lineItem, lineItems)
        const privilegeRequiredValue = campaignVerifyValues.reduce((acc: any, v: any) => {
            return `${acc ? `${acc},` : ''}${v.name}=${v.value}`
        }, '')

        const {
            promotionSetCode = '',
            promotionSetProposition = 999, //999,
        } = privilege || {};

        let {
            campaignCode = '',
            campaignName = '',
        } = privilege || {};

        const price = lineItem.price.value.centAmount
        let quantity = lineItem.quantity
        let noOfItem = 1
        if (getProductType(productType) === 'P') {
            quantity = 1
            noOfItem = lineItem.quantity
        }

        //! items.totalAmount = ค่า price * quantity
        const totalAmount = price * quantity

        return Array.from({ length: noOfItem }, () => {
            const sequence = `${sequenceCounter++}`.toString()

            if (sequence !== '1') {
                campaignCode = ''
                campaignName = ''
            }

            if (productType === 'free_gift') {
                return {
                    id: orderId,
                    sequence: sequence,
                    campaign: {
                        code: campaignCode,
                        name: campaignName,
                    },
                    proposition: '' + promotionSetProposition,
                    promotionSet: promotionSetCode,
                    promotionType: getPromotionType(productType),
                    group: '' + productGroup,
                    product: {
                        productType: getProductType(productType),
                        productCode,
                    },
                    mobile: '',
                    price: '0',
                    quantity: '' + quantity,
                    totalAmount: '0',
                    installmentAmount: '0',
                    depositAmount: '0',
                    netAmount: '0',
                    discountAmount: '0',
                    otherPaymentAmount: '0',
                    privilegeRequiredValue,
                    discounts: [],
                    otherPayments: [],
                    serials: [],
                    range: [],
                }
            }

            //! items.discountAmount = ค่า amount ใน discounts ทั้งหมดรวมกัน
            const { discountAmount: discountAmountBaht, discounts } = getItemDiscount({
                orderId,
                lineItem,
                sequence
            })

            //! items.otherPaymentAmount = ค่า amount ใน otherPayments ทั้งหมดรวมกัน
            const { otherPaymentAmount: otherPaymentAmountBaht, otherPayments } = getItemOtherPayment({
                orderId,
                lineItem,
                sequence
            })

            //! items.netAmount = ค่า (price * quantity) - discountAmount
            let netAmount = price * quantity
            netAmount -= BahtToStang(discountAmountBaht)

            return {
                id: orderId,
                sequence: sequence,
                campaign: {
                    code: campaignCode,
                    name: campaignName,
                },
                proposition: '' + promotionSetProposition,
                promotionSet: promotionSetCode,
                promotionType: getPromotionType(productType),
                group: '1',
                product: {
                    productType: getProductType(productType),
                    productCode,
                },
                mobile: '',
                price: '' + stangToBaht(price),
                quantity: '' + quantity,
                totalAmount: '' + stangToBaht(totalAmount),
                installmentAmount: '0',
                depositAmount: '0',
                netAmount: '' + stangToBaht(netAmount),
                discountAmount: '' + discountAmountBaht,
                otherPaymentAmount: '' + otherPaymentAmountBaht,
                privilegeRequiredValue,
                discounts,
                otherPayments,
                serials: [],
                range: [],
            }
        })
    })

    //! ค่า netAmount ใน items ทั้งหมดรวมกัน
    const totalAmount = sequenceItems.reduce((total: any, item: any) => total + +item.netAmount, 0,)
    //! From Custom Object
    const { discounts, otherPayments } = couponDiscounts
    //! ค่า discounts (นอก items) ทั้งหมดรวมกัน
    const discountAmount = discounts.reduce((total: any, discount: any) => total + +discount.amount, 0,)
    //! ค่า ค่า otherPayments (นอก items) ทั้งหมดรวมกัน
    const otherPaymentAmount = otherPayments.reduce((total: any, otherPayment: any) => total + +otherPayment.amount, 0,)
    //! ค่า totalAmount - discountAmount
    const totalAfterDiscount = totalAmount - discountAmount

    //! ค่า totalAmount - discountAmount - otherPaymentAmount - (ผลรวมของ otherPaymentAmount ใน items) 
    const itemOtherPaymentAmount = sequenceItems.reduce((total: any, item: any) => total + +item.otherPaymentAmount, 0,)
    const grandTotal = totalAmount - discountAmount - otherPaymentAmount - itemOtherPaymentAmount

    return {
        order: {
            orderId,
            customer: {
                id: customer.thaiId,
                name: `${customer.firstName} ${customer.lastName}`,
                address: getCustomerAddress(shippingAddress),
            },
            shop: {
                code: shopCode,
            },
            sale: {
                code: saleCode,
                name: saleName,
            },
            totalAmount: '' + totalAmount,
            discountAmount: '' + discountAmount,
            totalAfterDiscount: '' + totalAfterDiscount,
            otherPaymentAmount: '' + otherPaymentAmount,
            grandTotal: '' + grandTotal,
            discounts,
            otherPayments,
            items: sequenceItems,
        },
    };
}

export const createTSMSaleOrder = async (order: Order,couponDiscounts: GetCouponInformationResult, accessToken: string): Promise<CreateTSMSaleOrderResponse> => {
    try {
        const tsmOrderPayload = createTSMSaleOrderPayloadFromOrder(order, couponDiscounts)
        const response = await apigeeService.saveOrderTSM({ data: tsmOrderPayload, accessToken })

        if (!response) {
            return {
                success: false,
                response: { message: 'Internal Server Error' }
            }
        }

        const { code } = response || {}
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

        return {
            success: false,
            response: data
        }
    }
}

export const getPromotionType = (lineItemType: string) => {
    switch (lineItemType) {
        case 'main_product':
            return '0'
        case 'free_gift':
            return '1'
        case 'service':
            return '0'
        case 'add_on':
            return '2'
        // case 'insurance':
        //     return 'S'
        default:
            return '0'
    }
}

export const getProductType = (lineItemType: string) => {
    switch (lineItemType) {
        case 'main_product':
            return 'P'
        case 'service':
            return 'S'
        case 'add_on':
            return 'P'
        case 'insurance':
            return 'S'
        default:
            return 'P'
    }
}

export const getItemDiscount = ({
    orderId,
    lineItem,
    sequence,
}: {
    orderId: string
    lineItem: LineItem
    sequence: any
}) => {
    let discountAmount = 0
    let no = 1
    const discounts: any[] = []
    let privilege = lineItem?.custom?.fields?.privilege
    privilege = privilege && JSON.parse(privilege);
    let lineItemDiscounts = lineItem?.custom?.fields?.discounts
    lineItemDiscounts = (lineItemDiscounts ?? []).map((v: any) => JSON.parse(v))
    const { promotionSetCode } = privilege || {};
    for (const lineItemDiscount of lineItemDiscounts) {
        const { source, discountCode, benefitType, specialPrice, discountBaht } = lineItemDiscount
        if (benefitType === 'add_on') {
            const price = lineItem.price.value.centAmount
            const discount = price - specialPrice
            discounts.push(
                {
                    id: orderId,
                    sequence,
                    no: '' + no,
                    code: promotionSetCode,
                    amount: '' + stangToBaht(discount),
                    serial: '',
                }
            )
        }

        if (benefitType === 'main_product') {
            const discount = discountBaht
            const code = source === 'campaignDiscount' ? discountCode : promotionSetCode
            discounts.push(
                {
                    id: orderId,
                    sequence,
                    no: '' + no,
                    code,
                    amount: '' + stangToBaht(discount),
                    serial: '',
                }
            )
        }
        no++
    }
    discountAmount = discounts.reduce((total: number, discount: any) => {
        return total += +discount.amount
    }, 0)

    return {
        discountAmount,
        discounts
    }
}

export const getItemOtherPayment = ({
    orderId,
    lineItem,
    sequence,
}: {
    orderId: string
    lineItem: any
    sequence: any
}) => {
    let otherPaymentAmount = 0
    let lineItemOtherPayments = lineItem?.custom?.fields?.otherPayments
    lineItemOtherPayments = (lineItemOtherPayments ?? []).map((v: any) => JSON.parse(v))

    const otherPayments: any[] = lineItemOtherPayments.map((v: any, index: any) => ({
        id: orderId,
        sequence,
        no: `${index + 1}`.toString(),
        code: v.otherPaymentCode,
        amount: stangToBaht(v.otherPaymentAmt).toString(),
        serial: ""
    }))

    otherPaymentAmount = otherPayments.reduce((total: number, otherPayment: any) => {
        return total += +otherPayment.amount
    }, 0)

    return {
        otherPaymentAmount,
        otherPayments
    }
}


export const getCustomerAddress = (shippingAddress: Order["shippingAddress"]) => {
    const {
        postalCode = '',
        city: district = '',
        state: country = '',
        custom
    } = shippingAddress || {}

    const {
        houseNo = '',
        subDistrict = '',
    } = custom?.fields || {}

    return `${houseNo} ${subDistrict} ${district} ${country} ${postalCode}`
}

export const stangToBaht = (stang: number) => {
    const fractionDigits = 2

    return stang / Math.pow(10, fractionDigits)
}

export const BahtToStang = (baht: number) => {
    const fractionDigits = 2

    return baht * Math.pow(10, fractionDigits)
}

export const getCampaignVerifyValues = (lineItems: any[]) => {
    const mainProductLineItems = lineItems.find((lineItem: any) => {
        return lineItem.custom?.fields?.productType === 'main_product'
    })

    const campaignVerifyValues = (mainProductLineItems.custom?.fields?.campaignVerifyValues ?? []).map((v: any) => JSON.parse(v))

    return campaignVerifyValues
}

export const getCampaignVerifyValuesFromCurrentLineItem = (currentLineItem: any, lineItems: any[]) => {
    const productGroup = currentLineItem.custom?.fields?.productGroup
    const mainProductLineItems = lineItems.find((lineItem: any) => {
        return lineItem.custom?.fields?.productGroup === productGroup && lineItem.custom?.fields?.productType === 'main_product'
    })

    const campaignVerifyValues = (mainProductLineItems.custom?.fields?.campaignVerifyValues ?? []).map((v: any) => JSON.parse(v))

    return campaignVerifyValues
}