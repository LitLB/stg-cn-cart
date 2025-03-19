import { IAdapter } from '../interfaces/adapter.interface';
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
	REDEEM = 2, // Addon จะมีแต่ REDEEM 
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

export class TalonOneEffectConverter implements IAdapter {
	public name = 'talonOneEffectConverter'
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
		return value !== '' && value !== null && value !== undefined && value !== 'null';
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
			promotion_product_other_payment: promotionProductOtherPayment,
			promotion_product_group: promotionProductGroup,
			promotion_product_group_other_payment: promotionProductGroupOtherPayment,
			product_promotion_detail: productPromotionDetail,
			product_promotion_detail_other_payment:
			productPromotionDetailOtherPayment,
			product_promotion_detail_item: productPromotionDetailItem,
		} = effect.props.payload;

		const { promotion_product_param: promotionProductParam } = effect.props.payload;

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
			discountCode,
			otherPaymentCode,
			discount,
			otherPayment,
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


		const freeGiftPromotions =
			productPromotionDetails?.filter((productPromotionDetail: any) => {
				return [PromotionDetailType.FREE_GIFT].includes(
					+productPromotionDetail?.detail?.tsm_promotion_detail__promotion_type
				);
			}) || [];

		const freeGiftBenefits = freeGiftPromotions?.map((freeGiftPromotion: any) => {
			const { detail, items, otherPayments } = freeGiftPromotion;

			const {
				tsm_promotion_detail__promotion_type: promotionType,
				tsm_promotion_detail__max_items: maxItem,
				tsm_promotion_detail__group_code: group,
				tsm_promotion_detail__discount_baht: discountBaht,
				tsm_promotion_detail__discount_percent: discountPercent,
				tsm_promotion_detail__special_price: specialPrice,
				tsm_promotion_detail__force_promotion: isForcePromotion,
			} = detail;

			const freeGiftProductSkus = items.map((item: any) => {
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
				benefitType: 'free_gift',
				campaignCode,
				campaignName,
				promotionSetCode,
				promotionSetProposition,
				promotionType,
				maxReceive,
				maxItem,
				group,
				freeGiftProductSkus,
				discountBaht: Number(discountBaht),
				discountPercent: Number(discountPercent),
				specialPrice: Number(specialPrice),
				isForcePromotion,
				subsidies,
				totalSelectedItem: 0,
			};
		});

		const addOnPromotions =
			productPromotionDetails?.filter((productPromotionDetail: any) => {
				return [PromotionDetailType.REDEEM].includes(
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
					otherPaymentAmt: this.bahtToStang(Number(otherPaymentAmt))
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
					otherPaymentAmt: this.bahtToStang(Number(otherPaymentAmt))
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

		let campaignDiscount = null
		let campaignOtherPayment = null
		if (this.checkPlaceholderContainsValue(discountCode)) {
			const discountBaht = Number(discount.tsm_discount__dis_bath)
			const discountPercent = Number(discount.tsm_discount__dis_percent)
			campaignDiscount = {
				sku,
				productGroup,
				productType,
				cartItemPosition,
				cartItemSubPosition,
				benefitType: 'main_product',
				source: 'campaignDiscount',
				campaignCode,
				campaignName,
				discountCode,
				discountBaht: this.bahtToStang(Number(discountBaht)),
				discountPercent,
			}
		}

		if (this.checkPlaceholderContainsValue(otherPaymentCode)) {
			const otherPaymentAmt = Number(otherPayment.tsm_other_payment__amount)
			campaignOtherPayment = {
				sku,
				productGroup,
				productType,
				cartItemPosition,
				cartItemSubPosition,
				benefitType: 'main_product',
				source: 'campaignOtherPayment',
				campaignCode,
				campaignName,
				otherPaymentCode,
				otherPaymentAmt: this.bahtToStang(Number(otherPaymentAmt)),
			}
		}

		return {
			freeGiftBenefits,
			addOnBenefits,
			productGroupBenefits,
			productBenefits,
			campaignDiscount,
			campaignOtherPayment
		}
	}

	bahtToStang(baht: number) {
		const fractionDigits = 2

		return baht * Math.pow(10, fractionDigits)
	}

	async wrapCTFreeGiftContext(benefits: any[]) {
		const allSkus = benefits.flatMap((benefit) =>
			benefit.freeGiftProductSkus.map((product: any) => product.sku)
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
			const { freeGiftProductSkus, ...benefitDetail } = benefit;
			const freeGiftProductMap = freeGiftProductSkus
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

			const freeGiftProducts = [];
			for (const [productId, skus] of Object.entries(
				freeGiftProductMap as Record<string, any[]>
			)) {
				const { product, allVariants } = productMap[productId];
				const { masterVariant, variants, ...productDetail } = product;
				const matchedVariants = allVariants.filter((variant: any) =>
					skus.includes(variant.sku)
				);
				freeGiftProducts.push({
					...productDetail,
					variants: matchedVariants,
				});
			}

			const { discountBaht, specialPrice } = benefitDetail

			return {
				...benefitDetail,
				discountBaht: this.bahtToStang(discountBaht),
				specialPrice: this.bahtToStang(specialPrice),
				freeGiftProducts,
			};
		}).filter((benefit: any) => benefit.freeGiftProducts.length);

		return wrappedBenefits;
	}

	async wrapCTAddonContext(benefits: any[]) {
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
		}).filter((benefit: any) => benefit.addOnProducts.length);

		return wrappedBenefits;
	}

	async validate(ctCart: any, changes: any, action?: any) {
		const customerSessionPayload = talonOneIntegrationAdapter.buildCustomerSessionPayload({
			ctCartData: ctCart,
			action,
			changes
		})

		const customerSessionId = ctCart?.id
		const { customerSession, effects } = await talonOneIntegrationAdapter.updateCustomerSession(customerSessionId, customerSessionPayload, { dry: true })

		const { cartItems } = customerSession;
		const distintEffects = this.groupEffect(effects);
		const filteredEffects = this.filter(distintEffects);

		if (!filteredEffects.length) {
			return {
				isValid: true,
				errorMessage: ''
			}
		}
		const convertedEffects = filteredEffects.map((filteredEffect: any) => this.convert(filteredEffect, cartItems));
		const promotionSets = convertedEffects.map((convertedEffect) => convertedEffect.promotionSet)

		const benefits = convertedEffects.map((convertedEffect: any) => this.getBenefit(convertedEffect));
		const addOnBenefits = benefits.map((item: any) => item.addOnBenefits).flat();

		const freeGiftBenefits = benefits.map((item: any) => item.freeGiftBenefits).flat();

		const newCartItems = cartItems.map((cartItem: any) => {
			const { position } = cartItem

			const addOnBenefitByPositions = addOnBenefits.filter(
				(wrappedBenefit: any) => wrappedBenefit.cartItemPosition === position
			)

			const freeGiftBenefitByPositions = freeGiftBenefits.filter(
				(wrappedBenefit: any) => wrappedBenefit.cartItemPosition === position
			)

			const convertedEffect = (convertedEffects || []).find((convertedEffect: any) => convertedEffect.cartItemPosition === position)

			const {
				campaignCode,
				promotionSetCode,
				campaignVerifyKey
			} = convertedEffect || {}

			const campaignVerifyKeys = this.checkPlaceholderContainsValue(campaignVerifyKey) ? campaignVerifyKey : []

			const cleanedCampaignVerifyKeys = campaignVerifyKeys.map((campaignVerifyKey: any) => {
				const { 
					campaign_verify_key__name: name,
					campaign_verify_key__is_require: isRequire,
					campaign_verify_key__is_key_check_aging: isKeyCheckAging,
				} = campaignVerifyKey
				return {
					name,
					isRequire,
					isKeyCheckAging
				}
			})

			return {
				...cartItem,
				addOnBenefits: addOnBenefitByPositions,
				freeGiftBenefits: freeGiftBenefitByPositions,
				campaignVerifyKeys: cleanedCampaignVerifyKeys,
				campaignCode,
				promotionSetCode,
			}
		})

		// ! Validate Main Product
		const mainCartItems = newCartItems.filter((cartItem: any) => cartItem?.attributes.product_type === 'main_product')
		const campaignMap:any = {}
		let noCampaign = 0
		mainCartItems.forEach((mainCartItem:any) => {
			if (mainCartItem?.campaignCode) {
				campaignMap[mainCartItem.campaignCode] = (campaignMap?.[mainCartItem?.campaignCode] ?? 0) + mainCartItem.quantity;
			} else {
				noCampaign++
			}
		})

		const isHaveMultipleCampaignInCart = Object.keys(campaignMap).length > 1
		const isHaveCampaignInCart = Object.keys(campaignMap).length >= 1
		const isHaveNoCampaignInCart = noCampaign >= 1

		if (isHaveMultipleCampaignInCart) {
			return {
				isValid: false,
				errorMessage: 'Multiple campaigns in a single cart are not supported.'
			}
		}

		if (isHaveCampaignInCart && isHaveNoCampaignInCart) {
			return {
				isValid: false,
				errorMessage: 'A mix of campaign and non-campaign items in the cart is not supported.'
			}
		}

		const allowCampaignVerifyKeys: any[] = []

		if (action === 'add_product') {
			const changedItems = changes
			for (const newCartItem of newCartItems) {
				const { sku, attributes, campaignVerifyKeys } = newCartItem
				const { product_group: productGroup, product_type: productType } = attributes || {}

				allowCampaignVerifyKeys.push({
					sku: sku,
					productGroup: attributes.product_group,
					productType: attributes.product_type,
					campaignVerifyKeys: campaignVerifyKeys ?? [],
				})

				if (!campaignVerifyKeys.length) {
					continue
				}	

				const changedItem = changedItems.find((changedItem: any) =>
					changedItem.sku === sku &&
					changedItem.productGroup === productGroup &&
					changedItem.productType === productType
				)

				if (!changedItem) {
					continue
				}

				const { campaignVerifyValues = [] } = changedItem
				// TODO: Get campaign verify values from CT LineItem
				const { lineItems } = ctCart
				const existingLineItem = (lineItems || []).find((item: any) => {
					return item.variant.sku === changedItem.sku
						&& item.custom?.fields?.productGroup === changedItem.productGroup
						&& item.custom?.fields?.productType === changedItem.productType
					;
				});

				const existingCampaignVerifyValues = (existingLineItem?.custom?.fields?.campaignVerifyValues || []).map((campaignVerifyValue:any) => JSON.parse(campaignVerifyValue))

				for (const campaignVerifyKey of campaignVerifyKeys) {
					const { name } = campaignVerifyKey
					
					const matchedCampaignVerifyValue = campaignVerifyValues.find((campaignVerifyValue: any) => campaignVerifyValue.name === name && campaignVerifyValue.value)
					
					if (!matchedCampaignVerifyValue) {
						const matchedExistingCampaignVerifyValue = existingCampaignVerifyValues.find((campaignVerifyValue: any) => campaignVerifyValue.name === name && campaignVerifyValue.value)

						if (!matchedExistingCampaignVerifyValue) {
							return {
								isValid: false,
								isRequireCampaignVerify: true,
								errorMessage: `Campaign Verify Key '${name}' is required`,
								campaignVerifyKeys
							}
						}
					}
				}

                // Change step to validate campaign verify keys
                // Hard code max quantity
                const MAXIMUM_MAIN_PRODUCT_QUANTITY_PER_CAMPAIGN = 1

                const exceedQuantityLimitCartItem = newCartItems
                    .filter((cartItem: any) => cartItem?.attributes.product_type === 'main_product')
                    .filter((cartItem: any) => cartItem?.campaignCode)
                    .find((cartItem: any) => cartItem?.quantity > MAXIMUM_MAIN_PRODUCT_QUANTITY_PER_CAMPAIGN)
                if (exceedQuantityLimitCartItem) {
                    return {
                        isValid: false,
                        errorMessage: 'Exceed maximum quantity per campaign.',
                        errorCode: 'EXCEED_MAX_QUANTITY_PER_CAMPAIGN'
                    }
                }
			}
		}

		// ! Validate Secondary Product
		const mainProductCartItems = newCartItems.filter((cartItem: any) => cartItem?.attributes.product_type === 'main_product')

		let validateObject = mainProductCartItems.reduce((acc: any, item: any) => {
			const { addOnBenefits, freeGiftBenefits, attributes } = item
			const productGroup = attributes.product_group


			const allBenefits = [...addOnBenefits, ...freeGiftBenefits]
			const promotionSetCode = allBenefits?.[0]?.promotionSetCode

			const promotionSet = promotionSets.find((promotionSet: any) => promotionSet.tsm_promotion_set__code === promotionSetCode)

			const remainingMaxReceive = promotionSet?.tsm_promotion_set__max_receive || 0

			const remainingMaxItem = allBenefits?.reduce((acc: any, benefit: any) => {
				const { maxItem, group, benefitType } = benefit

				acc[benefitType] = acc[benefitType] || {}
				acc[benefitType][group] = maxItem

				return acc
			}, {})

			acc[productGroup] = {
				remainingMaxReceive,
				remainingMaxItem
			}
			return acc
		}, {})

		const addOnCartItems = newCartItems.filter((cartItem: any) => cartItem?.attributes.product_type === 'add_on')
		const freeGiftCartItems = newCartItems.filter((cartItem: any) => cartItem?.attributes.product_type === 'free_gift')

		const secondaryCartItems = [...addOnCartItems, ...freeGiftCartItems]

		validateObject = secondaryCartItems.reduce((acc: any, item: any) => {
			const { attributes, quantity } = item
			const productGroup = attributes.product_group
			const productType = attributes.product_type
			const addOnGroup = attributes.add_on_group
			const freeGiftGroup = attributes.free_gift_group

			const benefitGroup = productType === 'add_on' ? addOnGroup : freeGiftGroup

			const { remainingMaxReceive, remainingMaxItem } = acc[productGroup]
			acc[productGroup] = {
				remainingMaxReceive: remainingMaxReceive - quantity,
				remainingMaxItem: {
					...remainingMaxItem,
					[productType]: {
						...remainingMaxItem[productType],
						[benefitGroup]: (remainingMaxItem[productType][benefitGroup] || 0) - quantity,
					}
				}
			}

			return acc
		}, validateObject)

		let validateResult = {
			isValid: true,
			errorMessage: '',
			allowCampaignVerifyKeys,
		} as {
			isValid: boolean
			errorMessage: string
			allowCampaignVerifyKeys?: any[]
		}

		Object.entries(validateObject as Record<string, any>).forEach(([productGroup, limit]) => {
			const { remainingMaxReceive, remainingMaxItem } = limit
			if (remainingMaxReceive < 0) {
				validateResult = {
					isValid: false,
					errorMessage: `Total add-on and free gift reach limit for product group "${productGroup}"`
				}
				return
			}

			Object.entries(remainingMaxItem as Record<string, any>).forEach(
				([benefitType, groupMaxItem]) => {
					Object.entries(groupMaxItem as Record<string, number>).forEach(
						([group, maxItem]) => {
							if (maxItem < 0) {
								validateResult = {
									isValid: false,
									errorMessage: `Total ${benefitType} for group "${group}" reach limit for product group "${productGroup}"`
								}
								return
							}
						}
					)
				}
			)
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

	attachMainProductBenefits({
		lineItems,
		productGroupBenefits,
		productBenefits,
		campaignDiscounts,
		campaignOtherPayments
	}: {
		lineItems: any[];
		productGroupBenefits: any[];
		productBenefits: any[];
		campaignDiscounts: any[];
		campaignOtherPayments: any[]
	}) {
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

			let privilege = null
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
					otherPayments: otherPaymentsFromGroup
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
					product,
					otherPayments: otherPaymentsFromProduct
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
						productCode,
						minBuy,
						discountBaht,
						discountPercent,
						haveOtp,
						forcePromotion
					})
				}
			}

			const campaignDiscount = campaignDiscounts.find((campaignDiscount: any) => {
				return campaignDiscount.sku === sku &&
					campaignDiscount.productType === productType &&
					campaignDiscount.productGroup === productGroup
			})

			if (campaignDiscount) {
				const { 
					benefitType,
					productType,
					source,
					campaignCode,
					campaignName,
					discountCode,
					discountBaht
				} = campaignDiscount
				privilege = {
					...(privilege ? { ...privilege } : {}),
					discountCode
				}

				if (discountBaht > 0) {
					discounts.push({
						benefitType,
						productType,
						source,
						campaignCode,
						campaignName,
						discountCode,
						discountBaht
					})
				}
			}

			const campaignOtherPayment = campaignOtherPayments.find((campaignOtherPayment: any) => {
				return campaignOtherPayment.sku === sku &&
					campaignOtherPayment.productType === productType &&
					campaignOtherPayment.productGroup === productGroup
			})

			if (campaignOtherPayment) {
				const {
					benefitType,
					productType,
					source,
					campaignCode,
					campaignName,
					otherPaymentCode,
					otherPaymentAmt
				} = campaignOtherPayment

				privilege = {
					...(privilege ? { ...privilege } : {}),
					otherPaymentCode
				}

				otherPayments.push({
					benefitType,
					productType,
					source,
					campaignCode,
					campaignName,
					otherPaymentCode,
					otherPaymentAmt
				})
			}

			return {
				...newLineItem,
				privilege,
				discounts,
				otherPayments
			}
		})

		return newLineItems
	}

	attachFreeGiftBenefits(lineItems: any[], freeGiftBenefits: any[]) {
		const freeGiftItemsMapQuantity = lineItems
			.filter((lineItem: any) => lineItem?.custom.fields?.productType === 'free_gift')
			.reduce((acc: any, lineItem: any) => {
				const { variant, quantity } = lineItem
				const sku = variant.sku
				const productGroup = lineItem?.custom.fields?.productGroup
				const freeGiftGroup = lineItem?.custom.fields?.freeGiftGroup
				acc[productGroup] = acc[productGroup] || {}
				acc[productGroup][freeGiftGroup] = acc[productGroup][freeGiftGroup] || {}
				acc[productGroup][freeGiftGroup][sku] = quantity

				return acc;
			}, {});

		const lineItemsWithBenefits = lineItems.map((lineItem: any) => {
			const { custom, variant } = lineItem;
			const lineItemSku = variant.sku
			const lineItemProductType = custom?.fields?.productType
			const lineItemProductGroup = custom?.fields?.productGroup
			const lineItemExistingAvailableBenefits = lineItem.availableBenefits || [];

			const availableBenefits = freeGiftBenefits
				.filter((wrappedBenefit: any) => (
					wrappedBenefit.sku === lineItemSku &&
					wrappedBenefit.productType === lineItemProductType &&
					wrappedBenefit.productGroup === lineItemProductGroup
				))
				.map(
					({ freeGiftProducts, ...wrappedBenefit }: any) => {
						const { group: freeGiftGroup } = wrappedBenefit

						const allSkus = freeGiftProducts.flatMap((addOnProduct: any) =>
							addOnProduct.variants.map((variant: any) => variant.sku)
						);

						const totalSelectedItem = allSkus.reduce(
							(acc: any, currentSku: any) => {
								if (freeGiftItemsMapQuantity?.[lineItemProductGroup]?.[freeGiftGroup]?.[currentSku]) {
									acc += freeGiftItemsMapQuantity?.[lineItemProductGroup]?.[freeGiftGroup]?.[currentSku];
								}

								return acc;
							},
							0
						);

						const newFreeGiftProducts = freeGiftProducts.map((freeGiftProduct: any) => {
							const variants = freeGiftProduct.variants.map((variant: any) => ({
								...variant,
								totalSelectedItem: freeGiftItemsMapQuantity?.[lineItemProductGroup]?.[freeGiftGroup]?.[variant.sku] || 0,
							}))

							const totalSelectedItem = variants.reduce((acc:any, current: any) => {
								return acc + current.totalSelectedItem
							}, 0)
							return {
								...freeGiftProduct,
								variants,
								totalSelectedItem
							}
						});

						return {
							...wrappedBenefit,
							freeGiftProducts: newFreeGiftProducts,
							totalSelectedItem,
						};
					});

			return {
				...lineItem,
				availableBenefits: [...lineItemExistingAvailableBenefits, ...availableBenefits],
			};
		});

		const newLineItems = [...lineItemsWithBenefits].map((newLineItem: any) => {
			const { custom } = newLineItem
			const productType = custom?.fields?.productType

			if (productType !== 'free_gift') {
				return newLineItem
			}

			const productGroup = custom?.fields?.productGroup
			const freeGiftGroup = custom?.fields?.freeGiftGroup

			const mainProductLineItemWithBenefits = lineItemsWithBenefits.find((lineItemsWithBenefit: any) => {
				const { custom } = lineItemsWithBenefit
				return custom?.fields?.productType === 'main_product' &&
					custom?.fields?.productGroup === productGroup
			})

			const { availableBenefits } = mainProductLineItemWithBenefits
			const matchedBenefit = availableBenefits.find((availableBenefit: any) =>
				availableBenefit.benefitType === 'free_gift' &&
				availableBenefit.group === freeGiftGroup
			)

			let privilege = null
			const discounts = []

			if (matchedBenefit) {
				const {
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition,
					benefitType,
					group,
					discountBaht,
					discountPercent,
					specialPrice,
					isForcePromotion
				} = matchedBenefit;

				privilege = {
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition,
				};

				discounts.push({
					benefitType,
					promotionSetCode,
					promotionSetProposition,
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
			};
		});

		return newLineItems;
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
				const addOnGroup = lineItem?.custom.fields?.addOnGroup
				acc[productGroup] = acc[productGroup] || {}
				acc[productGroup][addOnGroup] = acc[productGroup][addOnGroup] || {}
				acc[productGroup][addOnGroup][sku] = quantity

				return acc;
			}, {});

		const lineItemsWithBenefits = lineItems.map((lineItem: any) => {
			const { custom, variant } = lineItem;
			const lineItemSku = variant.sku
			const lineItemProductType = custom?.fields?.productType
			const lineItemProductGroup = custom?.fields?.productGroup
			const lineItemExistingAvailableBenefits = lineItem.availableBenefits || [];

			const availableBenefits = addOnbenefits
				.filter(
					(wrappedBenefit: any) => {
						return wrappedBenefit.sku === lineItemSku &&
							wrappedBenefit.productType === lineItemProductType &&
							wrappedBenefit.productGroup === lineItemProductGroup
					})
				.map(
					({
						addOnProducts,
						...wrappedBenefit
					}: any) => {
						const { group: addOnGroup } = wrappedBenefit

						const allSkus = addOnProducts.flatMap((addOnProduct: any) =>
							addOnProduct.variants.map((variant: any) => variant.sku)
						);

						const totalSelectedItem = allSkus.reduce(
							(acc: any, currentSku: any) => {
								if (addOnItemsMapQuantity?.[lineItemProductGroup]?.[addOnGroup]?.[currentSku]) {
									acc += addOnItemsMapQuantity?.[lineItemProductGroup]?.[addOnGroup]?.[currentSku];
								}

								return acc;
							},
							0
						);

						const newAddOnProducts = addOnProducts.map((addOnProduct: any) => {
							const variants = addOnProduct.variants.map((variant: any) => ({
								...variant,
								totalSelectedItem: addOnItemsMapQuantity?.[lineItemProductGroup]?.[addOnGroup]?.[variant.sku] || 0,
							}))
							const totalSelectedItem = variants.reduce((acc:any, current: any) => {
								return acc + current.totalSelectedItem
							}, 0)
							return {
								...addOnProduct,
								variants,
								totalSelectedItem
							}
						});

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
				availableBenefits: [...lineItemExistingAvailableBenefits, ...availableBenefits],
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

			const mainProductLineItemWithBenefits = lineItemsWithBenefits.find((lineItemsWithBenefit: any) => {
				const { custom } = lineItemsWithBenefit
				return custom?.fields?.productType === 'main_product' &&
					custom?.fields?.productGroup === productGroup
			})

			const { availableBenefits } = mainProductLineItemWithBenefits

			const matchedBenefit = availableBenefits.find((availableBenefit: any) => {
				return availableBenefit.group === addOnGroup
			})

			let privilege = null
			const discounts = []
			if (matchedBenefit) {
				const {
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition,
					benefitType,
					group,
					discountBaht,
					discountPercent,
					specialPrice,
					isForcePromotion
				} = matchedBenefit
				privilege = {
					campaignCode,
					campaignName,
					promotionSetCode,
					promotionSetProposition,
				}

				discounts.push({
					benefitType,
					promotionSetCode,
					promotionSetProposition,
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
		// TODO: 1.2.1.2 Group multiple effect(s) to 1 effect.
		const distintEffects = this.groupEffect(effects);
		// TODO: 1.2.1.3 Filtered and get only effect type = bundle_package_item_device_only_v2.
		const filteredEffects = this.filter(distintEffects);
		// TODO: 1.2.1.4 Convert filteredEffects to convertedEffects
		const convertedEffects = filteredEffects.map((filteredEffect: any) => this.convert(filteredEffect, cartItems));
		// TODO: 1.2.1.5 Get Benefit(s) from convertedEffects.
		const benefits = convertedEffects.map((convertedEffect: any) => this.getBenefit(convertedEffect))

		const freeGiftBenefits = benefits.map((item: any) => item.freeGiftBenefits).flat();
		const wrappedFreeGiftbenefits = await this.wrapCTFreeGiftContext(freeGiftBenefits);

		const addOnBenefits = benefits.map((item: any) => item.addOnBenefits).flat();
		const wrappedAddOnbenefits = await this.wrapCTAddonContext(addOnBenefits);

		const productGroupBenefits = benefits.map((item: any) => item.productGroupBenefits).flat()

		const productBenefits = benefits.map((item: any) => item.productBenefits).flat()

		const campaignDiscounts = benefits.filter((item: any) => item.campaignDiscount).map((item: any) => item.campaignDiscount)
		const campaignOtherPayments = benefits.filter((item: any) => item.campaignDiscount).map((item: any) => item.campaignOtherPayment)

		return {
			freeGiftBenefits: wrappedFreeGiftbenefits,
			addOnbenefits: wrappedAddOnbenefits,
			productGroupBenefits,
			productBenefits,
			campaignDiscounts,
			campaignOtherPayments
		}
	}

	async getCtLineItemWithCampaignBenefits(ctCart: any) {
		const {
			freeGiftBenefits, 
			addOnbenefits, 
			productGroupBenefits, 
			productBenefits,
			campaignDiscounts,
			campaignOtherPayments
		} = await this.getBenefitByCtCart(ctCart)

		let { lineItems } = ctCart

		lineItems = this.attachMainProductBenefits({
			lineItems,
			productGroupBenefits,
			productBenefits,
			campaignDiscounts,
			campaignOtherPayments
		})
		lineItems = this.attachFreeGiftBenefits(lineItems, freeGiftBenefits)
		lineItems = this.attachAddOnBenefits(lineItems, addOnbenefits)

		return lineItems;
	}
}

export const talonOneEffectConverter = new TalonOneEffectConverter();
