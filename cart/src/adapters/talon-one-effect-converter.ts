import CommercetoolsProductClient from './ct-product-client';
import { talonOneIntegrationAdapter } from './talon-one.adapter'
enum AddOnType {
	REDEEM = 'redeem',
	DISCOUNT_BAHT = 'discount_baht',
	DISCOUNT_PERCENTAGE = 'discount_percentage',
	SUBSIDY = 'subsidy',
}

enum PromotionDetailType {
	FREE_GIFT = 1,
	REDEEM = 2,
	DISCOUNT_BAHT = 3,
	DISCOUNT_PERCENTAGE = 4,
	SUBSIDY = 5,
}

const getAddOnType = (promotionDetailType: PromotionDetailType) => {
	switch (promotionDetailType) {
		case PromotionDetailType.REDEEM:
			return AddOnType.REDEEM;
		case PromotionDetailType.DISCOUNT_BAHT:
			return AddOnType.DISCOUNT_BAHT;
		case PromotionDetailType.DISCOUNT_PERCENTAGE:
			return AddOnType.DISCOUNT_PERCENTAGE;
		case PromotionDetailType.SUBSIDY:
			return AddOnType.SUBSIDY;
		default:
			return AddOnType.REDEEM;
	}
};

class TalonOneEffectConverter {
	private readonly ctProductClient;
	private readonly talonOneIntegrationAdapter;
	constructor() {
		this.ctProductClient = CommercetoolsProductClient;
		this.talonOneIntegrationAdapter = talonOneIntegrationAdapter;
	}

	/**
	 * TODO: 1. filter effect "bundle_package_item_device_only_v2"
	 * TODO: 2. convert string to object
	 * TODO: 3. get benefit type add-on
	 * TODO: 4. get product detail from CT
	 * TODO: 5. build benefit add-on for frontend
	 */

	groupEffect(effects: any[]) {
		const effectMap = effects.reduce((acc: any, current: any) => {
			const { campaignId, rulesetId, ruleIndex, props } = current;
			const { name: effectName, cartItemPosition, cartItemSubPosition } = props;
			const combinedKey = [
				campaignId,
				rulesetId,
				ruleIndex,
				effectName,
				cartItemPosition,
			].join(':');

			if (acc?.[combinedKey]) {
				if (cartItemSubPosition !== null || cartItemSubPosition !== undefined) {
					acc[combinedKey] = {
						...acc[combinedKey],
						props: {
							...acc[combinedKey].props,
							cartItemSubPosition: [
								...acc[combinedKey].props.cartItemSubPosition,
								cartItemSubPosition,
							],
						},
					};
				}
			} else {
				acc[combinedKey] = {
					...current,
					props: {
						...current.props,
						cartItemSubPosition: [cartItemSubPosition],
					},
				};
			}

			return acc;
		}, {});

		const distintEffects = Object.values(effectMap);
		return distintEffects;
	}

	checkPlaceholderContainsValue(value: any) {
		return value !== null && value !== undefined && value !== 'null';
	}

	filter(effects: any[]) {
		const filteredEffects = effects
			.filter((effect: any) => effect?.props?.name === 'bundle_package_item_device_only_v2')
			.filter((effect: any) => this.checkPlaceholderContainsValue(effect?.props?.payload?.campaign_code) || this.checkPlaceholderContainsValue(effect?.props?.payload?.promotion_set_code))
			;
		return filteredEffects;
	}

	convert(effect: any, cartItems: any[]) {
		const { cartItemPosition, cartItemSubPosition } = effect.props;
		const {
			campaign_code: campaignCode,
			discount_code: discountCode,
			other_payment_code: otherPaymentCode,
			promotion_set_code: promotionSetCode,
		} = effect.props.payload;

		let {
			campaign,
			campaign_verify_key: campaignVerifyKey,
			discount,
			other_payment: otherPayment,
			promotion_set: promotionSet,
			promotion_product: promotionProduct,
			promotion_product_param: promotionProductParam,
			promotion_product_other_payment: promotionProductOtherPayment,
			promotion_product_group: promotionProductGroup,
			promotion_product_group_other_payment: promotionProductGroupOtherPayment,
			product_promotion_detail: productPromotionDetail,
			product_promotion_detail_other_payment:
			productPromotionDetailOtherPayment,
			product_promotion_detail_item: productPromotionDetailItem,
		} = effect.props.payload;

		campaign = campaign ? JSON.parse(campaign) : null;
		campaignVerifyKey = campaignVerifyKey
			? JSON.parse(campaignVerifyKey)
			: null;
		discount = discount ? JSON.parse(discount) : null;
		otherPayment = otherPayment ? JSON.parse(otherPayment) : null;

		promotionSet = promotionSet ? JSON.parse(promotionSet) : null;
		promotionProduct = promotionProduct ? JSON.parse(promotionProduct) : null;
		promotionProductOtherPayment = promotionProductOtherPayment ? JSON.parse(promotionProductOtherPayment) : null;

		const promotionProducts = (promotionProduct ?? [])?.map(
			(eachPromotionProduct: any) => {
				const { tsm_promotion_product__product_code } = eachPromotionProduct;
				const otherPayments =
					promotionProductOtherPayment?.filter(
						(otherPayment: any) =>
							otherPayment?.tsm_promotion_product_other_payment__group_code ===
							tsm_promotion_product__product_code
					) || [];
				return {
					...eachPromotionProduct,
					otherPayments,
				};
			}
		);

		const promotionProductParams = promotionProductParam
			? JSON.parse(promotionProductParam)
			: null;

		promotionProductGroupOtherPayment = promotionProductGroupOtherPayment
			? JSON.parse(promotionProductGroupOtherPayment)
			: null;

		promotionProductGroup = promotionProductGroup
			? JSON.parse(promotionProductGroup)
			: null;

		const promotionProductGroupMap =
			promotionProductGroup?.reduce((acc: any, current: any) => {
				const groupCode = current.tsm_promotion_product_group__group_code;
				if (!acc?.[groupCode]) {
					const otherPayments =
						promotionProductGroupOtherPayment?.filter(
							(otherPayment: any) =>
								otherPayment?.tsm_promotion_product_group_other_payment__group_code ===
								groupCode
						) || [];
					acc[groupCode] = {
						groupCode,
						products: [],
						otherPayments: otherPayments,
					};
				}

				acc[groupCode].products.push(current);

				return acc;
			}, {}) || {};

		const promotionProductGroups = Object.values(promotionProductGroupMap);

		productPromotionDetailItem = productPromotionDetailItem
			? JSON.parse(productPromotionDetailItem)
			: null;
		productPromotionDetailOtherPayment = productPromotionDetailOtherPayment
			? JSON.parse(productPromotionDetailOtherPayment)
			: null;

		productPromotionDetail = productPromotionDetail
			? JSON.parse(productPromotionDetail)
			: null;

		const productPromotionDetails = (productPromotionDetail ?? [])?.map(
			(eachProductPromotionDetail: any) => {
				const groupCode =
					eachProductPromotionDetail.tsm_promotion_detail__group_code;
				const otherPayments =
					productPromotionDetailOtherPayment?.filter(
						(otherPayment: any) =>
							otherPayment?.tsm_promotion_detail_other_payment__group_code ===
							groupCode
					) || [];

				const items =
					productPromotionDetailItem?.filter(
						(item: any) =>
							item?.tsm_promotion_detail_item__group_code === groupCode
					) || [];

				return {
					groupCode,
					detail: eachProductPromotionDetail,
					items: items,
					otherPayments: otherPayments,
				};
			}
		);
		const selectedCartItem = cartItems.find((cartItem: any) => cartItem.position === cartItemPosition)

		return {
			sku: selectedCartItem.sku,
			productGroup: selectedCartItem.attributes.product_group,
			productType: selectedCartItem.attributes.product_type,
			cartItemPosition,
			cartItemSubPosition,
			campaignCode,
			discountCode,
			otherPaymentCode,
			promotionSetCode,
			campaign,
			campaignVerifyKey,
			discount,
			otherPayment,
			promotionSet,
			promotionProducts,
			promotionProductParams,
			promotionProductGroups,
			productPromotionDetails,
		};
	}

	getBenefit(convertedEffect: any) {
		const {
			sku,
			productGroup,
			productType,
			cartItemPosition,
			cartItemSubPosition,
			campaignCode,
			campaign,
			promotionSetCode,
			promotionSet,
			productPromotionDetails,
			promotionProducts,
			promotionProductGroups,
		} = convertedEffect;


		let minSale = 0
		let maxReceive = 0
		let promotionSetProposition = null
		if (promotionSet) {
			maxReceive = promotionSet.tsm_promotion_set__max_receive
			minSale = promotionSet.tsm_promotion_set__min_sale_item
			promotionSetProposition = promotionSet.tsm_promotion_set__proposition_code
		}

		const campaignName = campaign?.campaign__name || ''
		

		const addOnPromotions =
			productPromotionDetails?.filter((productPromotionDetail: any) => {
				return [
					0,
					PromotionDetailType.REDEEM,
					//   PromotionDetailType.DISCOUNT_BAHT,
					//   PromotionDetailType.DISCOUNT_PERCENTAGE,
					//   PromotionDetailType.SUBSIDY,
				].includes(
					+productPromotionDetail?.detail?.tsm_promotion_detail__promotion_type
				);
			}) || [];

		const addOnBenefits = addOnPromotions?.map((addOnPromotion: any) => {
			const { detail, items, otherPayments } = addOnPromotion;

			const {
				tsm_promotion_detail__promotion_type: promotionType,
				tsm_promotion_detail__max_items: maxItem,
				tsm_promotion_detail__group_code: group,
				tsm_promotion_detail__discount_baht: discountBaht,
				tsm_promotion_detail__discount_percent: discountPercent,
				tsm_promotion_detail__special_price: specialPrice,
				tsm_promotion_detail__force_promotion: isForcePromotion,
			} = detail;

			const addOnProductSkus = items.map((item: any) => {
				const {
					tsm_promotion_detail_item__product_code: sku,
					tsm_promotion_detail_item__type: type,
				} = item;
				return {
					sku,
					type,
				};
			});

			const subsidies =
				otherPayments?.map((otherPayment: any) => {
					const {
						tsm_promotion_detail_other_payment__other_payment_type_code:
						otherPaymentCode,
						tsm_promotion_detail_other_payment__other_payment_amt:
						otherPaymentAmount,
					} = otherPayment;
					return {
						otherPaymentCode,
						otherPaymentAmount,
					};
				}) || [];

			return {
				sku,
				productGroup,
				productType,
				cartItemPosition,
				cartItemSubPosition,
				benefitType: 'add_on',
				campaignCode,
				campaignName,
				promotionSetCode,
				promotionSetProposition,
				addOnType: getAddOnType(promotionType),
				maxReceive,
				maxItem,
				group,
				addOnProductSkus,
				discountBaht: Number(discountBaht),
				discountPercent: Number(discountPercent),
				specialPrice: Number(specialPrice),
				isForcePromotion,
				subsidies,
				totalSelectedItem: 0,
			};
		});

		const productGroupBenefits: any[] = (promotionProductGroups ?? []).map((promotionProductGroup: any) => {
			const { groupCode, products, otherPayments } = promotionProductGroup

			const newProducts = products.map((product: any) => {
				const {
					tsm_promotion_set__code: promotionSetCode,
					tsm_promotion_product_group__type: type,
					tsm_promotion_product_group__group_code: groupCode,
					tsm_promotion_product_group__product_code: productCode,
					tsm_promotion_product_group__min_buy: minBuy,
					tsm_promotion_product_group__discount_baht: discountBaht,
					tsm_promotion_product_group__discount_percent: discountPercent,
					tsm_promotion_product_group__have_otp: haveOtp,
					tsm_promotion_product_group__force_promotion: forcePromotion
				} = product
				return {
					source: 'promotionProductGroup',
					promotionSetCode,
					productType: type,
					groupCode,
					productCode,
					minBuy,
					discountBaht: this.bahtToStang(Number(discountBaht)),
					discountPercent: Number(discountPercent),
					haveOtp,
					forcePromotion
				}
			})
			// TODO
			const newOtherPayments = otherPayments.map((otherPayment: any) => {
				const {
					tsm_promotion_set__code: promotionSetCode,
					tsm_promotion_product_group_other_payment__type: type,
					tsm_promotion_product_group_other_payment__group_code: groupCode,
					tsm_promotion_product_group_other_payment__product_code: productCode,
					tsm_promotion_product_group_other_payment__other_payment_type_code: otherPaymentCode,
					tsm_promotion_product_group_other_payment__other_payment_amt: otherPaymentAmt,
				} = otherPayment
				return {
					source: 'promotionProductGroupOtherPayment',
					promotionSetCode,
					productType: type,
					groupCode,
					productCode,
					otherPaymentCode,
					otherPaymentAmt : this.bahtToStang(Number(otherPaymentAmt))
				}
			})

			return {
				sku,
				productGroup,
				productType,
				cartItemPosition,
				cartItemSubPosition,
				benefitType: 'main_product',
				campaignCode,
				campaignName,
				promotionSetCode,
				promotionSetProposition,
				groupCode,
				products: newProducts,
				otherPayments: newOtherPayments
			}
		})

		const productBenefits: any[] = (promotionProducts ?? []).map((promotionProduct: any) => {
			const {
				tsm_promotion_set__code: promotionSetCode,
				tsm_promotion_product__type: type,
				tsm_promotion_product__product_code: productCode,
				tsm_promotion_product__min_buy: minBuy,
				tsm_promotion_product__discount_baht: discountBaht,
				tsm_promotion_product__discount_percent: discountPercent,
				tsm_promotion_product__have_otp: haveOtp,
				tsm_promotion_product__force_promotion: forcePromotion,
				otherPayments
			} = promotionProduct

			const product = {
				source: 'promotionProduct',
				promotionSetCode,
				promotionSetProposition,
				productType: type,
				productCode,
				minBuy,
				discountBaht: this.bahtToStang(Number(discountBaht)),
				discountPercent: Number(discountPercent),
				haveOtp,
				forcePromotion,
			}
			// TODO
			const newOtherPayments = otherPayments.map((otherPayment: any) => {
				const {
					tsm_promotion_set__code: promotionSetCode,
					// tsm_promotion_product_group_other_payment__type: type,
					tsm_promotion_product_other_payment__group_code: productCode,
					tsm_promotion_product_other_payment__promotion_set_code: otherPaymentPromotionSetCode,
					tsm_promotion_product_other_payment__other_payment_type_code: otherPaymentCode,
					tsm_promotion_product_other_payment__other_payment_amt: otherPaymentAmt,
				} = otherPayment
				return {
					source: 'promotionProductOtherPayment',
					promotionSetCode,
					// productType: type,
					// groupCode,
					productCode,
					otherPaymentPromotionSetCode,
					otherPaymentCode,
					otherPaymentAmt : this.bahtToStang(Number(otherPaymentAmt))
				}
			})

			return {
				sku,
				productGroup,
				productType,
				cartItemPosition,
				cartItemSubPosition,
				benefitType: 'main_product',
				campaignCode,
				campaignName,
				promotionSetCode,
				promotionSetProposition,
				product,
				otherPayments: newOtherPayments
			}
		})

		// ! For multi promotion set & campaign need to have wrapper this benefit on top level such as "campaignCode", "promotionSetCode", "discountCode"
		// ! For multiple cart need to handle by using cartItemPosition, cartItemSubPosition
		return {
			addOnBenefits,
			productGroupBenefits,
			productBenefits
		}
	}

	bahtToStang(baht: number) {
		const fractionDigits = 2

		return baht * Math.pow(10, fractionDigits)
	}

	async wrapCTContext(benefits: any[]) {
		// get skus from benefits

		const allSkus = benefits.flatMap((benefit) =>
			benefit.addOnProductSkus.map((product: any) => product.sku)
		);

		let products = [];
		if (allSkus.length) {
			const result = await this.ctProductClient.getProductsBySkus(allSkus);
			products = result?.body?.results;
		}

		let skuMapProductId: any = {};
		const productMap: any = {};

		products.forEach((product: any) => {
			const { id: productId, masterVariant, variants } = product;
			const allVariants = [masterVariant, ...variants];

			skuMapProductId = allVariants.reduce((acc: any, variant: any) => {
				const sku = variant.sku;

				acc[sku] = productId;

				return acc;
			}, skuMapProductId);

			productMap[productId] = {
				product,
				allVariants,
			};
		});

		const wrappedBenefits = benefits.map((benefit: any) => {
			const { addOnProductSkus, ...benefitDetail } = benefit;
			const addOnProductMap = addOnProductSkus
				.map((product: any) => product.sku)
				.reduce((acc: any, sku: any) => {
					const productId = skuMapProductId[sku]
					if (!productId) {
						return acc;
					}
					if (!acc?.[productId]) {
						acc[productId] = [];
					}

					acc[skuMapProductId[sku]].push(sku);

					return acc;
				}, {});

			const addOnProducts = [];
			for (const [productId, skus] of Object.entries(
				addOnProductMap as Record<string, any[]>
			)) {
				const { product, allVariants } = productMap[productId];
				const { masterVariant, variants, ...productDetail } = product;
				const matchedVariants = allVariants.filter((variant: any) =>
					skus.includes(variant.sku)
				);
				addOnProducts.push({
					...productDetail,
					variants: matchedVariants,
				});
			}

			const { discountBaht, specialPrice } = benefitDetail

			return {
				...benefitDetail,
				discountBaht: this.bahtToStang(discountBaht),
				specialPrice: this.bahtToStang(specialPrice),
				addOnProducts,
			};
		});

		return wrappedBenefits;
	}

	async validate(ctCart: any, changes: any, action?: any) {
		const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
			ctCartData: ctCart,
			action,
			changes
		})

		const mainProductOnly = customerSessionPayload?.customerSession?.cartItems?.every((cartItem: any) => cartItem?.attributes.product_type === 'main_product')

		if (mainProductOnly) {
			return {
				isValid: true,
				errorMessage: ''
			}
		}

		const customerSessionId = ctCart?.id
		const { customerSession, effects } = await talonOneIntegrationAdapter.updateCustomerSession(customerSessionId, customerSessionPayload, { dry: true })

		const { cartItems } = customerSession;
		const distintEffects = this.groupEffect(effects);
		const filteredEffects = this.filter(distintEffects);
		const convertedEffects = filteredEffects.map((filteredEffect: any) => this.convert(filteredEffect, cartItems));
		const promotionSets = convertedEffects.map((convertedEffect) => convertedEffect.promotionSet)

		const benefits = convertedEffects.map((convertedEffect: any) => this.getBenefit(convertedEffect));
		const addOnBenefits = benefits.map((item: any) => item.addOnBenefits).flat();

		const newCartItems = cartItems.map((cartItem: any) => {
			const { position } = cartItem

			const benefitByPositions = addOnBenefits.filter(
				(wrappedBenefit: any) => wrappedBenefit.cartItemPosition === position
			)

			return {
				...cartItem,
				addOnBenefits: benefitByPositions
			}
		})

		const mainProductCartItems = newCartItems.filter((cartItem: any) => cartItem?.attributes.product_type === 'main_product')

		const addOnCartItems = newCartItems.filter((cartItem: any) => cartItem?.attributes.product_type === 'add_on')


		let validateObject = mainProductCartItems.reduce((acc: any, item: any) => {
			const { addOnBenefits, attributes } = item
			const productGroup = attributes.product_group
			const promotionSetCode = addOnBenefits?.[0]?.promotionSetCode

			const promotionSet = promotionSets.find((promotionSet: any) => promotionSet.tsm_promotion_set__code === promotionSetCode)

			const remainingMaxReceive = promotionSet?.tsm_promotion_set__max_receive || 0

			const remainingMaxItem = addOnBenefits?.reduce((acc: any, addOnbenefit: any) => {
				const { maxItem, group } = addOnbenefit
				acc[group] = maxItem
				return acc
			}, {})

			acc[productGroup] = {
				remainingMaxReceive,
				remainingMaxItem
			}
			return acc
		}, {})

		validateObject = addOnCartItems.reduce((acc: any, item: any) => {
			const { attributes, quantity } = item
			const productGroup = attributes.product_group
			const addOnGroup = attributes.add_on_group
			const { remainingMaxReceive, remainingMaxItem } = acc[productGroup]
			acc[productGroup] = {
				remainingMaxReceive: remainingMaxReceive - quantity,
				remainingMaxItem: {
					...remainingMaxItem,
					[addOnGroup]: remainingMaxItem[addOnGroup] - quantity
				}
			}

			return acc
		}, validateObject)

		let validateResult = {
			isValid: true,
			errorMessage: ''
		}

		Object.entries(validateObject as Record<string, any>).forEach(([productGroup, limit]) => {
			const { remainingMaxReceive, remainingMaxItem } = limit
			if (remainingMaxReceive < 0) {
				validateResult = {
					isValid: false,
					errorMessage: `Total add-on reach limit for product group "${productGroup}"`
				}
				return
			}

			Object.entries(remainingMaxItem as Record<string, number>).forEach(([addOnGroup, maxItem]) => {
				if (maxItem < 0) {
					validateResult = {
						isValid: false,
						errorMessage: `Total add-on group "${addOnGroup}" reach limit for product group "${productGroup}"`
					}
					return
				}
			})
		});

		return validateResult
	}

	async updateCustomerSession(ctCartData: any) {
		const customerSessionPayload = this.talonOneIntegrationAdapter.buildCustomerSessionPayload({
			ctCartData
		})

		const customerSessionId = ctCartData?.id
		const customerSession = await talonOneIntegrationAdapter.updateCustomerSession(customerSessionId, customerSessionPayload)

		return customerSession
	}

	attachMainProductBenefits(lineItems: any[], productGroupBenefits: any[], productBenefits: any[]) {
		const newLineItems = [...lineItems].map((newLineItem: any) => {
			const { variant, custom } = newLineItem
			const sku = variant.sku
			const productType = custom?.fields?.productType
			const productGroup = custom?.fields?.productGroup

			if (productType !== 'main_product') {
				return newLineItem
			}
			const productGroupBenefit = productGroupBenefits.find((productGroupBenefit: any) => {
				return productGroupBenefit.sku === sku &&
					productGroupBenefit.productType === productType &&
					productGroupBenefit.productGroup === productGroup
			})

			let privilege = {}
			const discounts: any[] = []
			const otherPayments: any[] = []
			if (productGroupBenefit) {
				const {
					benefitType,
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition,
					groupCode,
					products,
					otherPayments : otherPaymentsFromGroup
				} = productGroupBenefit

				const product = products.find((product: any) => product.productCode === sku)
				const {
					source,
					productType,
					productCode,
					minBuy,
					discountBaht,
					discountPercent,
					haveOtp,
					forcePromotion
				} = product

				// Find other payments
				const otherPayment = otherPaymentsFromGroup.find((otherPayment: any) => otherPayment.productCode === sku)
				if (otherPayment) {
					const { otherPaymentCode, otherPaymentAmt } = otherPayment

					otherPayments.push({
						source: 'promotionProductGroupOtherPayment',
						promotionSetCode,
						productType,
						groupCode,
						productCode,
						otherPaymentCode,
						otherPaymentAmt
					})
				}

				privilege = {
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition
				}

				if (discountBaht > 0) {
					discounts.push({
						benefitType,
						promotionSetCode,
						promotionSetProposition,
						source,
						productType,
						groupCode,
						productCode,
						minBuy,
						discountBaht,
						discountPercent,
						haveOtp,
						forcePromotion
					})
				}
			}

			const productBenefit = productBenefits.find((productBenefit: any) => {
				return productBenefit.sku === sku &&
				productBenefit.productType === productType &&
				productBenefit.productGroup === productGroup
			})

			if (productBenefit) {
				const {
					benefitType,
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition,
					// groupCode,
					product,
					otherPayments : otherPaymentsFromProduct
				} = productBenefit

				const {
					source,
					productType,
					productCode,
					minBuy,
					discountBaht,
					discountPercent,
					haveOtp,
					forcePromotion
				} = product

				privilege = {
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition
				}

				// Find other payments
				const otherPayment = otherPaymentsFromProduct.find((otherPayment: any) => otherPayment.productCode === sku)
				if (otherPayment) {
					const { otherPaymentCode, otherPaymentAmt } = otherPayment

					otherPayments.push({
						source: 'promotionProductOtherPayment',
						promotionSetCode,
						productCode,
						otherPaymentCode,
						otherPaymentAmt
					})
				}

				if (discountBaht > 0) {
					discounts.push({
						benefitType,
						promotionSetCode,
						promotionSetProposition,
						source,
						productType,
						// groupCode,
						productCode,
						minBuy,
						discountBaht,
						discountPercent,
						haveOtp,
						forcePromotion
					})
				}
			}
/// why
			return {
				...newLineItem,
				privilege,
				discounts,
				otherPayments
			}
		})

		return newLineItems
	}

	attachAddOnBenefits(lineItems: any[], addOnbenefits: any[]) {
		const addOnItemsMapQuantity = lineItems
			.filter(
				(lineItem: any) => lineItem?.custom.fields?.productType === 'add_on'
			)
			.reduce((acc: any, lineItem: any) => {
				// TODO: addOnGroup
				const { variant, quantity } = lineItem
				const sku = variant.sku
				const productGroup = lineItem?.custom.fields?.productGroup
				acc[productGroup] = acc[productGroup] || {}
				acc[productGroup][sku] = quantity

				return acc;
			}, {});

		const lineItemsWithBenefits = lineItems.map((lineItem: any) => {
			const { custom, variant } = lineItem;
			const sku = variant.sku
			const productType = custom?.fields?.productType
			const productGroup = custom?.fields?.productGroup

			const availableBenefits = addOnbenefits
				.filter(
					(wrappedBenefit: any) => {
						return wrappedBenefit.sku === sku &&
							wrappedBenefit.productType === productType &&
							wrappedBenefit.productGroup === productGroup
					})
				.map(
					({
						addOnProducts,
						...wrappedBenefit
					}: any) => {
						const allSkus = addOnProducts.flatMap((addOnProduct: any) =>
							addOnProduct.variants.map((variant: any) => variant.sku)
						);
						const totalSelectedItem = allSkus.reduce(
							(acc: any, currentSku: any) => {
								if (addOnItemsMapQuantity?.[productGroup]?.[currentSku]) {
									acc += addOnItemsMapQuantity?.[productGroup]?.[currentSku];
								}

								return acc;
							},
							0
						);

						const newAddOnProducts = addOnProducts.map((addOnProduct: any) => ({
							...addOnProduct,
							variants: addOnProduct.variants.map((variant: any) => ({
								...variant,
								totalSelectedItem: addOnItemsMapQuantity?.[productGroup]?.[variant.sku] || 0,
							})),
						}));

						// TODO: Condition need to have product group as well
						return {
							...wrappedBenefit,
							addOnProducts: newAddOnProducts,
							totalSelectedItem,
						};
					}
				);

			return {
				...lineItem,
				availableBenefits,
			};
		});

		const newLineItems = [...lineItemsWithBenefits].map((newLineItem: any) => {
			const { custom } = newLineItem
			const productType = custom?.fields?.productType
			if (productType !== 'add_on') {
				return newLineItem
			}
			const productGroup = custom?.fields?.productGroup
			const addOnGroup = custom?.fields?.addOnGroup
			// ! Add On

			const mainProductLineItemWithBenefits = lineItemsWithBenefits.find((lineItemsWithBenefit: any) => {
				const { custom } = lineItemsWithBenefit
				return custom?.fields?.productType === 'main_product' &&
					custom?.fields?.productGroup === productGroup
			})

			const { availableBenefits } = mainProductLineItemWithBenefits

			const matchedBenefit = availableBenefits.find((availableBenefit: any) => {
				return availableBenefit.group === addOnGroup
			})

			let privilege = {}
			const discounts = []
			if (matchedBenefit) {
				const {
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition,
					benefitType,
					// type,
					group,
					discountBaht,
					discountPercent,
					specialPrice,
					isForcePromotion
				} = matchedBenefit
				privilege = {
					// TODO: add promotion set detail, max received. curren total selected item
					// benefitType,
					// type,
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition,
					// group,
					// discountBaht,
					// discountPercent,
					// specialPrice,
					// isForcePromotion
				}

				discounts.push({
					benefitType,
					campaignCode,
					promotionSetCode,
					promotionSetProposition,
					// type,
					group,
					discountBaht,
					discountPercent,
					specialPrice,
					isForcePromotion
				})
			}

			return {
				...newLineItem,
				privilege,
				discounts
			}
		})

		return newLineItems
	}

	// TODO: 1.2.1 Get Benefit(s) from CT Cart
	async getBenefitByCtCart(ctCart: any) {
		// TODO: 1.2.1.1 Upsert T1 Custom Session with CT Cart
		const customerSession = await talonOneIntegrationAdapter.getActiveCustomerSession(ctCart)
		const { customerSession: { cartItems }, effects } = customerSession;
		console.log('JSON.stringify(cartItems)', JSON.stringify(cartItems));
		console.log('JSON.stringify(effects)', JSON.stringify(effects));

		// TODO: 1.2.1.2 Group multiple effect(s) to 1 effect.
		const distintEffects = this.groupEffect(effects);
		console.log('JSON.stringify(distintEffects)', JSON.stringify(distintEffects));

		// TODO: 1.2.1.3 Filtered and get only effect type = bundle_package_item_device_only_v2.
		const filteredEffects = this.filter(distintEffects);
		console.log('JSON.stringify(filteredEffects)', JSON.stringify(filteredEffects));

		// TODO: 1.2.1.4 Convert filteredEffects to convertedEffects
		const convertedEffects = filteredEffects.map((filteredEffect: any) => this.convert(filteredEffect, cartItems));
		console.log('JSON.stringify(convertedEffects)', JSON.stringify(convertedEffects));

		// TODO: 1.2.1.5 Get Benefit(s) from convertedEffects.
		const benefits = convertedEffects.map((convertedEffect: any) => this.getBenefit(convertedEffect))
		console.log('JSON.stringify(benefits)', JSON.stringify(benefits));

		const addOnBenefits = benefits.map((item: any) => item.addOnBenefits).flat();
		console.log('JSON.stringify(addOnBenefits)', JSON.stringify(addOnBenefits));

		const wrappedAddOnbenefits = await this.wrapCTContext(addOnBenefits);
		console.log('JSON.stringify(wrappedAddOnbenefits)', JSON.stringify(wrappedAddOnbenefits));

		const productGroupBenefits = benefits.map((item: any) => item.productGroupBenefits).flat()
		console.log('JSON.stringify(productGroupBenefits)', JSON.stringify(productGroupBenefits));

		const productBenefits = benefits.map((item: any) => item.productBenefits).flat()
		console.log('JSON.stringify(productBenefits)', JSON.stringify(productBenefits));

		return {
			addOnbenefits: wrappedAddOnbenefits,
			productGroupBenefits,
			productBenefits
		}
	}

	async getBenefitByCustomerSession(customerSession: any) {
		const { customerSession: { cartItems }, effects } = customerSession;
		const distintEffects = this.groupEffect(effects);
		const filteredEffects = this.filter(distintEffects);
		const convertedEffects = filteredEffects.map((filteredEffect: any) => this.convert(filteredEffect, cartItems));

		const benefits = convertedEffects.map((convertedEffect: any) => this.getBenefit(convertedEffect));
		const addOnBenefits = benefits.map((item: any) => item.addOnBenefits).flat();
		const wrappedAddOnbenefits = await this.wrapCTContext(addOnBenefits);

		const productGroupBenefits = benefits.map((item: any) => item.productGroupBenefits).flat()
		const productBenefits = benefits.map((item: any) => item.productBenefits).flat()

		return {
			addOnbenefits: wrappedAddOnbenefits,
			productGroupBenefits,
			productBenefits
		}
	}

	// TODO: 1.2 Get Benefit(s)
	async getCtLineItemWithCampaignBenefits(ctCart: any) {
		// TODO: 1.2.1 Get Benefit(s) from CT Cart
		const { addOnbenefits, productGroupBenefits, productBenefits } = await this.getBenefitByCtCart(ctCart)

		let { lineItems } = ctCart

		// TODO: 1.2.2 Attach Main Product Benefits
		lineItems = this.attachMainProductBenefits(lineItems, productGroupBenefits, productBenefits)

		// TODO: 1.2.3 Attach Addon Benefits
		lineItems = this.attachAddOnBenefits(lineItems, addOnbenefits)


		return lineItems;
	}

	async getCustomerSessionWithConvertedEffectsById(ctCart: any) {
		const customerSession = await talonOneIntegrationAdapter.getActiveCustomerSession(ctCart)
		const { customerSession: customerSessionInfo, effects } = customerSession;
		const { cartItems } = customerSessionInfo
		const distintEffects = this.groupEffect(effects);
		const filteredEffects = this.filter(distintEffects);
		const convertedEffects = filteredEffects.map((filteredEffect: any) => this.convert(filteredEffect, cartItems));
		return {
			customerSession: {
				...customerSessionInfo,
				effects: convertedEffects,
			},
		};
	}
}

export const talonOneEffectConverter = new TalonOneEffectConverter();
