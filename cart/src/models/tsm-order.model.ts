import { apigeeEncrypt } from '../utils/apigeeEncrypt.utils'
import { Attribute, Cart, LineItem } from '@commercetools/platform-sdk'
import ctCustomObjectClient from '../adapters/ct-custom-object-client'
import * as ORDER_CONSTANTS from '../constants/order.constant'
import { logger } from '../utils/logger.utils'

export default class TsmOrderModel {
	private readonly ctCart: any
	private readonly config: any
	private readonly orderNumber: string
	private readonly couponDiscounts: any


	constructor({
		ctCart,
		orderNumber,
		config,
		couponDiscounts
	}: {
		ctCart: Cart,
		orderNumber: string
		config: any,
		couponDiscounts: any
	}) {

		this.ctCart = ctCart
		this.config = config
		this.orderNumber = orderNumber
		this.couponDiscounts = couponDiscounts
	}

	async toPayload() {

		try {
			// ! Config
			const shopCode = this.config.tsmOrder.shopCode
			const saleCode = this.config.tsmOrder.saleCode
			const saleName = this.config.tsmOrder.saleName

			const apigeePrivateKeyEncryption = this.config.apigee.privateKeyEncryption

			// ! Generate
			const orderId = this.orderNumber

			// ! Cart
			const { shippingAddress, lineItems, customLineItems } = this.ctCart as Cart
			const customerInfo = JSON.parse(this.ctCart.custom?.fields.customerInfo)
			const thaiId = customerInfo && customerInfo?.customerProfile?.certificationId || customerInfo?.verifyCertificationIdValue || ''
			const mobile = customerInfo && customerInfo?.verifyMobileNumberValue || ''
			const encryptedThaiId = thaiId ? apigeeEncrypt(thaiId, apigeePrivateKeyEncryption) : ''
			const encryptedMobileNumber = mobile ? apigeeEncrypt(mobile, apigeePrivateKeyEncryption) : ''
			
			const customer = {
				thaiId: encryptedThaiId,
				firstName: shippingAddress?.firstName,
				lastName: shippingAddress?.lastName,
			}
			
			// TODO filter lineItems by selected
			let sequenceCounter = 1
			const filteredItem: LineItem[] = []
			let productBundle: Partial<LineItem> = {}
			const promotionSet: Record<string, Partial<LineItem>> = {}

			for (const lineItem of lineItems) {
				if (this.getProductType(lineItem.custom?.fields?.productType) !== 'O') {
					filteredItem.push(lineItem)
				}

				if (lineItem.custom?.fields?.productType === 'product-bundle') {
					productBundle = lineItem
				} else if (lineItem.custom?.fields?.productType === 'promotion_set') {
                    // in case journey is "single_product" and main_product difference promotion
                    if (lineItem.variant.attributes) {
                        lineItem.variant.attributes.forEach((attr: Attribute) => {
                            if (attr.name === 'variants') {
                                const variants = attr.value as string[]
                                variants.forEach((variant: string) => {
                                    promotionSet[variant] = lineItem
                                })
                            }
                        })
                    }
				}
			}			

			const advancePayment = customLineItems && customLineItems.find(v => v.slug === 'advance-payment')
			const extraAdvancePayment = customLineItems && customLineItems.find(v => v.slug === 'extra-advance-payment')

			let promotionSetCode = ''
			let promotionSetProposition = 999


			const sequenceItems = filteredItem.flatMap((lineItem: LineItem) => {
				const productCode = lineItem.variant.sku!
				const productGroup = lineItem.custom?.fields?.productGroup
				const productType = lineItem.custom?.fields?.productType

                const promotionSetMatched = promotionSet[productCode]

				const campaignVerifyValues = (productBundle?.variant?.attributes?.find(v => v.name === 'verifyKeys')?.value || []) as string[]
				const privilegeRequiredValue = campaignVerifyValues && campaignVerifyValues.length > 0 ? campaignVerifyValues.map(v => { return { name: v, value: v === 'MSISDN' ? mobile : thaiId } }) : []
				
				const newPrivilegeRequiredValue = privilegeRequiredValue.reduce((acc, v) => {
					return `${acc ? `${acc},` : ''}${v.name}=${v.value}`
				}, '')				

				let campaignCode = '';
				let campaignName = '';


				if (productBundle?.variant?.attributes) {
					for (const attribute of productBundle.variant.attributes) {
						if (attribute.name === 'campaignCode') {
							campaignCode = attribute.value
						}
						if (attribute.name === 'campaignName') {
							campaignName = attribute.value
						}
					}
				}


				if (promotionSetMatched?.variant?.attributes) {
					for (const attribute of promotionSetMatched.variant.attributes) {
						if (attribute.name === 'code') {
							promotionSetCode = attribute.value
						}
						if (attribute.name === 'propositionCode') {
							promotionSetProposition = attribute.value
						}
					}
				}

				const price = lineItem.price.value.centAmount
				let quantity = lineItem.quantity
				let noOfItem = 1
				if (this.getProductType(productType) === 'P') {
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
							proposition: `${promotionSetProposition}`,
							promotionSet: promotionSetCode,
							promotionType: this.getPromotionType(productType),
							group: `${productGroup}`,
							product: {
								productType: this.getProductType(productType),
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
					const { discountAmount: discountAmountBaht, discounts } = this.getItemDiscount({
						orderId,
						lineItem,
						sequence,
					})

					//! items.otherPaymentAmount = ค่า amount ใน otherPayments ทั้งหมดรวมกัน
					const { otherPaymentAmount: otherPaymentAmountBaht, otherPayments } = this.getItemOtherPayment({
						orderId,
						lineItem,
						sequence,
					})

					//! items.netAmount = ค่า (price * quantity) - discountAmount
					let netAmount = price * quantity
					netAmount -= this.bahtToStang(discountAmountBaht)

					if (productType === 'sim') {
						return {
							id: orderId,
							sequence: sequence,
							campaign: {
								code: '',
								name: '',
							},
							proposition: `${promotionSetProposition}`,
							promotionSet: promotionSetCode,
							promotionType: this.getPromotionType(productType),
							group: '1',
							product: {
								productType: this.getProductType(productType),
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
							privilegeRequiredValue: newPrivilegeRequiredValue,
							discounts: [],
							otherPayments: [],
							serials: [],
							range: [],
						}
					}

					return {
						id: orderId,
						sequence: sequence,
						campaign: {
							code: campaignCode,
							name: campaignName,
						},
						proposition: `${promotionSetProposition}`,
						promotionSet: promotionSetCode,
						promotionType: this.getPromotionType(productType),
						group: '1',
						product: {
							productType: this.getProductType(productType),
							productCode,
						},
						mobile: sequence === '1' ? encryptedMobileNumber : '',
						price: `${this.stangToBaht(price)}`,
						quantity: `${quantity}`,
						totalAmount: `${this.stangToBaht(totalAmount)}`,
						installmentAmount: '0',
						depositAmount: '0',
						netAmount: `${this.stangToBaht(netAmount)}`,
						discountAmount: `${discountAmountBaht}`,
						otherPaymentAmount: `${otherPaymentAmountBaht}`,
						privilegeRequiredValue: newPrivilegeRequiredValue,
						discounts,
						otherPayments,
						serials: [],
						range: [],
					}
				})
			})

			if (advancePayment) {

                const promotionSetMatched = Object.values(promotionSet)[0]

				const advancePaymentCode = productBundle?.variant?.attributes?.find(v => v.name === 'payAdvanceServiceCode')?.value ?? ''

				if (promotionSetMatched?.variant?.attributes) {
					for (const attribute of promotionSetMatched.variant.attributes) {
						if (attribute.name === 'code') {
							promotionSetCode = attribute.value
						}
						if (attribute.name === 'propositionCode') {
							promotionSetProposition = attribute.value
						}
					}
				}

				sequenceItems.push({
					id: orderId,
					sequence: `${sequenceCounter++}`.toString(),
					campaign: { code: "", name: "" },
					proposition: `${promotionSetProposition}`,
					promotionSet: promotionSetCode,
					promotionType: "0",
					group: "1",
					product: {
						productType: "S",
						productCode: advancePaymentCode
					},
					mobile: "",
					price: `${this.stangToBaht(advancePayment.money.centAmount)}`,
					quantity: "1",
					totalAmount: `${this.stangToBaht(advancePayment.money.centAmount)}`,
					installmentAmount: "0",
					depositAmount: "0",
					netAmount: `${this.stangToBaht(advancePayment.money.centAmount)}`,
					discountAmount: "0",
					otherPaymentAmount: "0",
					privilegeRequiredValue: "",
					discounts: [],
					otherPayments: [],
					serials: [],
					range: []
				})
			}

			if (extraAdvancePayment) {

				const extraAdvancePaymentCode = this.ctCart.custom?.fields?.packageAdditionalInfo?.obj?.value?.t1?.serviceCode;

				if (promotionSet.variant?.attributes) {
					for (const attribute of promotionSet.variant.attributes) {
						if (attribute.name === 'code') {
							promotionSetCode = attribute.value
						}
						if (attribute.name === 'propositionCode') {
							promotionSetProposition = attribute.value
						}
					}
				}

				sequenceItems.push({
					id: orderId,
					sequence: `${sequenceCounter++}`.toString(),
					campaign: { code: "", name: "" },
					proposition: `${promotionSetProposition}`,
					promotionSet: promotionSetCode,
					promotionType: "0",
					group: "1",
					product: {
						productType: "S",
						productCode: extraAdvancePaymentCode
					},
					mobile: "",
					price: `${this.stangToBaht(extraAdvancePayment.money.centAmount)}`,
					quantity: "1",
					totalAmount: `${this.stangToBaht(extraAdvancePayment.money.centAmount)}`,
					installmentAmount: "0",
					depositAmount: "0",
					netAmount: `${this.stangToBaht(extraAdvancePayment.money.centAmount)}`,
					discountAmount: "0",
					otherPaymentAmount: "0",
					privilegeRequiredValue: "",
					discounts: [],
					otherPayments: [],
					serials: [],
					range: []
				})
			}

			//! ค่า netAmount ใน items ทั้งหมดรวมกัน
			const totalAmount = sequenceItems.reduce((total: number, item: any) => total + Number(item.netAmount), 0)

			//! From Custom Object
			const { discounts, otherPayments } = this.couponDiscounts

			//! ค่า discounts (นอก items) ทั้งหมดรวมกัน
			const discountAmount = discounts.reduce((total: number, discount: any) => total + Number(discount.amount), 0)

			//! ค่า ค่า otherPayments (นอก items) ทั้งหมดรวมกัน
			const otherPaymentAmount = otherPayments.reduce((total: number, otherPayment: any) => total + Number(otherPayment.amount), 0)

			//! ค่า totalAmount - discountAmount
			const totalAfterDiscount = totalAmount - discountAmount

			//! ค่า totalAmount - discountAmount - otherPaymentAmount - (ผลรวมของ otherPaymentAmount ใน items) 
			const itemOtherPaymentAmount = sequenceItems.reduce((total: any, item: any) => total + +item.otherPaymentAmount, 0)

			const grandTotal = totalAmount - (discountAmount + otherPaymentAmount + itemOtherPaymentAmount)

			return {
				order: {
					orderId,
					customer: {
						id: customer.thaiId,
						name: `${customer.firstName} ${customer.lastName}`,
						address: this.getCustomerAddress(),
					},
					shop: {
						code: shopCode,
					},
					sale: {
						code: saleCode,
						name: saleName,
					},
					totalAmount: `${totalAmount}`,
					discountAmount: `${discountAmount}`,
					totalAfterDiscount: `${totalAfterDiscount}`,
					otherPaymentAmount: `${otherPaymentAmount}`,
					grandTotal: `${grandTotal}`,
					discounts,
					otherPayments,
					items: sequenceItems,
				},
			};
		} catch (error) {
			logger.error('Error in TsmOrderModel.toPayload:', error);
		}
	}

	getPromotionType = (lineItemType: string) => {
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

	getProductType = (lineItemType: string) => {

		switch (lineItemType) {
			case 'service':
			case 'insurance':
				return 'S'
			case 'product-bundle':
			case 'package':
			case 'promotion_set':
				return 'O'
			case 'main_product':
			case 'add_on':
			case 'sim':
			default:
				return 'P'
		}
	}

	getItemDiscount = ({
		orderId,
		lineItem,
		sequence,
	}: {
		orderId: string
		lineItem: any
		sequence: any,
	}) => {
		let discountAmount = 0
		let no = 1
		const discounts: { id: string, sequence: string, no: string, code: string, amount: string, serial: string }[] = []

		const lineItemDiscounts: { code: string, amount: number }[] = (lineItem?.custom?.fields?.discounts ?? []).map((item: string) => JSON.parse(item))

		for (const lineItemDiscount of lineItemDiscounts) {
			discounts.push({
				id: orderId,
				sequence,
				no: `${no}`,
				code: lineItemDiscount.code,
				amount: `${this.stangToBaht(lineItemDiscount.amount)}`,
				serial: '',
			})

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

	getItemOtherPayment = ({
		orderId,
		lineItem,
		sequence,
	}: {
		orderId: string
		lineItem: any
		sequence: any
	}) => {
		let otherPaymentAmount = 0
		const lineItemOtherPayments: { code: string, amount: number }[] = (lineItem?.custom?.fields?.otherPayments ?? []).map((item: string) => JSON.parse(item))

		const otherPayments: { id: string, sequence: string, no: string, code: string, amount: string, serial: string }[] = lineItemOtherPayments.map((item: { code: string, amount: number }, index: number) => ({
			id: orderId,
			sequence,
			no: `${index + 1}`.toString(),
			code: item.code,
			amount: this.stangToBaht(item.amount).toString(),
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


	getCustomerAddress = () => {
		const { shippingAddress } = this.ctCart
		if (!shippingAddress) return ''

		const {
			postalCode = '',
			city: district = '',
			state: country = '',
			custom = {}
		} = shippingAddress

		const {
			houseNo = '',
			subDistrict = ''
		} = custom

		return [houseNo, subDistrict, district, country, postalCode]
			.filter(Boolean)
			.join(' ')
	}

	stangToBaht(stang: number) {
		const fractionDigits = 2

		return stang / Math.pow(10, fractionDigits)
	}

	bahtToStang(baht: number) {
		const fractionDigits = 2

		return baht * Math.pow(10, fractionDigits)
	}

	getCampaignVerifyValues(lineItems: any[]) {
		const mainProductLineItems = lineItems.find((lineItem: LineItem) => {
			return lineItem.custom?.fields?.productType === 'main_product'
		})

		const campaignVerifyValues = (mainProductLineItems.custom?.fields?.campaignVerifyValues ?? []).map((item: any) => JSON.parse(item))

		return campaignVerifyValues
	}

	getCampaignVerifyValuesFromCurrentLineItem = (currentLineItem: any, lineItems: any[]) => {
		const productGroup = currentLineItem.custom?.fields?.productGroup
		const mainProductLineItems = lineItems.find((lineItem: any) => {
			return lineItem.custom?.fields?.productGroup === productGroup && lineItem.custom?.fields?.productType === 'main_product'
		})

		const campaignVerifyValues = (mainProductLineItems.custom?.fields?.campaignVerifyValues ?? []).map((item: any) => JSON.parse(item))

		return campaignVerifyValues
	}

	async getPromotionSetCustomObject(promotionSet: any) {
		try {
			const productGroupSetKeys = this.extractAttributeValue(promotionSet.variant.attributes, 'promotionProductGroups', []);
			const productSetKeys = this.extractAttributeValue(promotionSet.variant.attributes, 'promotionProducts', []);

			const productGroupSetQuery = this.buildCustomObjectQuery(ORDER_CONSTANTS.PROMOTION_SET_PRODUCT_GROUP, productGroupSetKeys);
			const productSetQuery = this.buildCustomObjectQuery(ORDER_CONSTANTS.PROMOTION_SET_PRODUCT, productSetKeys);

			const [promotionSetProductGroup, promotionSetProduct] = await Promise.all([
				ctCustomObjectClient.queryCustomObject(productGroupSetQuery, 100, 0),
				ctCustomObjectClient.queryCustomObject(productSetQuery, 100, 0),
			]);

			return {
				promotionSetProductGroup: promotionSetProductGroup.body.results,
				promotionSetProduct: promotionSetProduct.body.results,
			};
		} catch (error) {
			console.error('Error getting promotion set custom object:', error);

			return {
				promotionSetProductGroup: [],
				promotionSetProduct: [],
			};
		}
	}

	private extractAttributeValue(attributes: any[], name: string, defaultValue: any[] = []) {
		const attribute = attributes.find(item => item.name === name);
		return attribute ? attribute.value : defaultValue;
	}

	private buildCustomObjectQuery(container: string, keys: string[]) {
		return `container = "${container}" AND key in (${keys.map(v => `"${v}"`).join(', ')})`.replace(/\s/g, ' ');
	}
}