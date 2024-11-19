import CommercetoolsProductClient from '~/server/adapters/ct-product-client';
import { talonOneIntegrationAdapter } from '~/server/adapters/talon-one.adapter'
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

	checkPlaceholderContainsValue(value:any) {
		return value !== null && value !== undefined && value !== 'null';
	}

	filter(effects: any[]) {
		const filteredEffects = effects
			.filter((effect: any) => effect?.props?.name === 'bundle_package_item_device_only_v2')
			.filter((effect: any) => this.checkPlaceholderContainsValue(effect?.props?.payload?.campaign_code) || this.checkPlaceholderContainsValue(effect?.props?.payload?.promotion_set_code))
			;
		return filteredEffects;
	}

	convert(effect: any) {
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
		promotionProductOtherPayment = promotionProductOtherPayment
			? JSON.parse(promotionProductOtherPayment)
			: null;

		const promotionProducts = promotionProduct?.map(
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

		const productPromotionDetails = productPromotionDetail?.map(
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

		return {
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

	getBenefits(convertedEffect: any) {
		const {
			cartItemPosition,
			cartItemSubPosition,
			campaignCode,
			promotionSetCode,
			productPromotionDetails,
		} = convertedEffect;
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
				cartItemPosition,
				cartItemSubPosition,
				campaignCode,
				promotionSetCode,
				type: 'add_on',
				addOnType: getAddOnType(promotionType),
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

		return [...addOnBenefits];
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
			let addOnProductMap = addOnProductSkus
				.map((product: any) => product.sku)
				.reduce((acc: any, sku: any) => {
					if (!acc?.[skuMapProductId[sku]]) {
						acc[skuMapProductId[sku]] = [];
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
		const customerSession = await talonOneIntegrationAdapter.updateCustomerSession(customerSessionId, customerSessionPayload, { dry: true })

		const { customerSession: customerSessionInfo, effects } = customerSession;
		const { cartItems } = customerSessionInfo;

		const distintEffects = this.groupEffect(effects);
		const filteredEffects = this.filter(distintEffects);
		const convertedEffects = filteredEffects.map(this.convert);
		const promotionSets = convertedEffects.map((convertedEffect) => convertedEffect.promotionSet)

		const benefits = convertedEffects.map(this.getBenefits).flat();
		const addOnbenefits = benefits.filter((benefit: any) => benefit.type === 'add_on')

		const newCartItems = cartItems.map((cartItem: any) => {
			const { position } = cartItem

			const benefitByPositions = addOnbenefits.filter(
				(wrappedBenefit: any) => wrappedBenefit.cartItemPosition === position
			)

			return {
				...cartItem,
				addOnbenefits: benefitByPositions
			}
		})

		const mainProductCartItems = newCartItems.filter((cartItem: any) => cartItem?.attributes.product_type === 'main_product')

		const addOnCartItems = newCartItems.filter((cartItem: any) => cartItem?.attributes.product_type === 'add_on')


		let validateObject = mainProductCartItems.reduce((acc: any, item: any) => {
			const { addOnbenefits, attributes } = item
			const productGroup = attributes.product_group
			const promotionSetCode = addOnbenefits?.[0]?.promotionSetCode

			const promotionSet = promotionSets.find((promotionSet: any) => promotionSet.tsm_promotion_set__code === promotionSetCode)

			const remainingMaxReceive = promotionSet?.tsm_promotion_set__max_receive || 0

			const remainingMaxItem = addOnbenefits?.reduce((acc: any, addOnbenefit: any) => {
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

	attachAddOnbenefits(cartItems: any[], wrappedAddOnbenefits: any[]) {
		const addOnItemsMapQuantity = cartItems
			.filter(
				(cartItem: any) => cartItem?.attributes?.product_type === 'add_on'
			)
			.reduce((acc: any, item: any) => {
				// TODO: addOnGroup
				const { sku, quantity, attributes } = item
				const { product_group: productGroup } = attributes
				acc[productGroup] = acc[productGroup] || {}
				acc[productGroup][sku] = quantity

				return acc;
			}, {});

		const cartItemsWithBenefits = cartItems.map((cartItem: any) => {
			const { position, attributes } = cartItem;
			const { product_group: productGroup } = attributes

			const benefitByPositions = wrappedAddOnbenefits
				.filter(
					(wrappedBenefit: any) => wrappedBenefit.cartItemPosition === position
				)
				.map(
					({
						cartItemPosition,
						cartItemSubPosition,
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
				...cartItem,
				availableBenefits: benefitByPositions,
			};
		});

		return cartItemsWithBenefits
	}

	attachAddOnPrivileges(cartItemWithBenefits: any[]) {
		let newCartItems = [...cartItemWithBenefits].map((newCartItem: any) => {
			const { attributes } = newCartItem
			const productType = attributes?.product_type
			if (productType !== 'add_on') {
				return newCartItem
			}
			const productGroup = attributes?.product_group
			const addOnGroup = attributes?.add_on_group
			// ! Add On

			const mainProductCartItemWithBenefits = cartItemWithBenefits.find((cartItemWithBenefit: any) => {
				const { attributes } = cartItemWithBenefit
				return attributes?.product_type === 'main_product' &&
					attributes?.product_group === productGroup
			})

			const { availableBenefits } = mainProductCartItemWithBenefits

			const matchedBenefit = availableBenefits.find((availableBenefit: any) => {
				return availableBenefit.group === addOnGroup
			})

			let privilege = {}

			if (matchedBenefit) {
				const {
					campaignCode,
					promotionSetCode,
					type,
					group,
					discountBaht,
					discountPercent,
					specialPrice,
					isForcePromotion
				} = matchedBenefit
				privilege = {
					campaignCode,
					promotionSetCode,
					type,
					group,
					discountBaht,
					discountPercent,
					specialPrice,
					isForcePromotion
				}
			}

			return {
				...newCartItem,
				privilege
			}
		})

		return newCartItems
	}

	async getCustomerSessionWithCampaignBenefit(customerSessionId: string) {
		const customerSession = await talonOneIntegrationAdapter.getCustomerSession(customerSessionId)
		const { customerSession: customerSessionInfo, effects } = customerSession;
		const { cartItems } = customerSessionInfo;

		const distintEffects = this.groupEffect(effects);
		const filteredEffects = this.filter(distintEffects);
		const convertedEffects = filteredEffects.map(this.convert);

		const benefits = convertedEffects.map(this.getBenefits).flat();

		const addOnbenefits = benefits.filter((benefit: any) => benefit.type === 'add_on')
		const wrappedAddOnbenefits = await this.wrapCTContext(addOnbenefits);

		let newCartItems = this.attachAddOnbenefits(cartItems, wrappedAddOnbenefits)
		newCartItems = this.attachAddOnPrivileges(newCartItems)
		return {
			customerSession: {
				...customerSessionInfo,
				cartItems: newCartItems,
			},
		};
	}
}

export const talonOneEffectConverter = new TalonOneEffectConverter();
