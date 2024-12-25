import * as talonOne from "talon_one";
import { readConfiguration } from "../utils/config.utils";
import { validateCouponLimit } from "../validators/coupon.validator";
import { ApiResponse } from '../types/response.type';
import { logger } from "../utils/logger.utils";
import { HTTP_STATUSES } from "../constants/http.constant";

class TalonOneIntegrationAdapter {
	private readonly integrationApi: talonOne.IntegrationApi;
	constructor() {
		const defaultClient = talonOne.ApiClient.instance;
		defaultClient.basePath = readConfiguration().t1.basePath;
		const api_key_v1 = defaultClient.authentications["api_key_v1"];
		api_key_v1.apiKey = readConfiguration().t1.apiKey;
		api_key_v1.apiKeyPrefix = readConfiguration().t1.prefixApiKey;
		this.integrationApi = new talonOne.IntegrationApi();
	}

	// ! Used to retrieve only closed customer sessions because the response is a snapshot effect.
	getCustomerSession(customerSessionId: string) {
		return this.integrationApi.getCustomerSession(customerSessionId);
	}

	async getActiveCustomerSession(ctCart: any) {
		const customerSessionId = ctCart?.id
		const customerSessionPayload = this.buildCustomerSessionPayload({ ctCartData: ctCart })
		return talonOneIntegrationAdapter.updateCustomerSession(customerSessionId, customerSessionPayload);
	}

	updateCustomerSession(
		customerSessionId: string,
		// payload: ICustomerSession,
		payload: any,
		opt?: any
	) {
		return this.integrationApi.updateCustomerSessionV2(
			customerSessionId,
			payload,
			opt
		);
	}

	mergeChanges(cartItems: any[], action: any, changes: any[]) {
		const mergedCartItems = [...cartItems]; // Start with a copy of the original cart items

		changes.forEach(change => {
			// Find index of the item with the same SKU in mergedCartItems
			const index = mergedCartItems.findIndex(item => {

				return item.sku === change.sku &&
					item.attributes.product_type === change.productType &&
					item.attributes.product_group === change.productGroup
			});

			if (index !== -1) {
				// If the SKU exists, update the quantity
				if (action === 'add_product') {
					mergedCartItems[index].quantity = mergedCartItems[index].quantity + change.quantity;
				} else {
					if (change.quantity > 0) {
						mergedCartItems[index].quantity = change.quantity;
					} else {
						mergedCartItems.splice(index, 1);
						// handle secondary remove
					}
				}
			} else {
				// If the SKU does not exist, add the new item
				mergedCartItems.push({
					sku: change.sku,
					quantity: change.quantity,
					price: change.price || 0,
					attributes: {
						product_type: change.productType,
						product_group: change.productGroup,
						...(change.addOnGroup ? { add_on_group: change.addOnGroup } : {})
					}
				});
			}
		});

		return mergedCartItems
	}

	buildCustomerSessionPayload({
		profileId = 'guest',
		action,
		changes,
		ctCartData,
		state,
		couponCodes,
	}: {
		profileId?: string
		action?: string
		changes?: any[]
		ctCartData: any,
		state?: any
		couponCodes?: string[]
	}) {
		const { lineItems } = ctCartData

		const campaignGroup = 'mass'
		const journey = 'device_only'
		const cartItems = lineItems.map((item: any) => {
			const { quantity, price, variant, custom } = item
			const productType = custom.fields.productType
			const productGroup = custom.fields.productGroup
			const addOnGroup = custom.fields.addOnGroup
			return {
				sku: variant.sku,
				quantity,
				price: price.value.centAmount / Math.pow(10, price.value.fractionDigits),
				attributes: {
					product_type: productType,
					product_group: productGroup,
					...(addOnGroup ? { add_on_group: addOnGroup } : {})
				}
			}
		})

		changes = changes?.length ? changes : []
		const newCartItems = this.mergeChanges(cartItems, action, changes)
		return {
			customerSession: {
				profileId,
				...(state ? { state } : {}),
				attributes: {
					// campaign_group: campaignGroup,
					// journey: journey,
					cart_journeys: ["device_only"]
				},
				cartItems: newCartItems,
				couponCodes,
			},
			responseContent: [
				"customerSession",
				"customerProfile",
				"triggeredCampaigns",
				"coupons"
			]
		}
	}

	async manageCouponsById(
		id: any,
		couponCodes: string[],
		removeCouponCodes: string[],
	): Promise<{ applyCoupons: string[], error: ApiResponse | undefined }> {

		// Get the customer session from the adapter
		let customerSession;
		try {
			customerSession = await talonOneIntegrationAdapter.getCustomerSession(id);
		} catch (error: any) {
			logger.info('TalonOne getCustomerSession error', error);
			return { applyCoupons: [], error: {
				statusCode: HTTP_STATUSES.BAD_REQUEST,
                errorCode: "APPLIYED_COUPON_CT_FAILED",
                statusMessage: `No products found.`,
			} };
		}

		// Initialize applyCoupons with the current coupon codes
		let applyCoupons = [...couponCodes];

		// Merge and deduplicate coupon codes from the customer session
		if (couponCodes.length > 0 && customerSession?.customerSession?.couponCodes?.length > 0) {
			applyCoupons = Array.from(new Set([...couponCodes, ...customerSession.customerSession.couponCodes]));
		}

		// Identify coupons to remove based on session effects
		const removeCodeEff = customerSession.effects
			.filter(
				(effect: { effectType: string; props: { value: string } }) =>
					effect.effectType === 'rejectCoupon' && !couponCodes.includes(effect.props.value)
			)
			.map((effect: { props: { value: string } }) => effect.props.value);

		removeCouponCodes = [...removeCouponCodes ,...removeCodeEff]
		// Validate coupon limit
		const validationError = validateCouponLimit(applyCoupons.length);
		if (validationError) {
			return { applyCoupons: [], error: validationError };
		}

		// Remove invalid coupons from applyCoupons
		if (removeCouponCodes.length > 0) {
			applyCoupons = applyCoupons.filter(item => !removeCouponCodes.includes(item));
		}

		return { applyCoupons, error: undefined };
	}

	// Retrieves the customer inventory based on the specified options.
	getCustomerInventoryByOptions(integrationId = 'guest', opts: {
		profile?: boolean | undefined;
		referrals?: boolean | undefined;
		coupons?: boolean | undefined;
		loyalty?: boolean | undefined;
		giveaways?: boolean | undefined;
		achievements?: boolean | undefined;
	}) {
		return this.integrationApi.getCustomerInventory(integrationId, opts);
	}
}

export const talonOneIntegrationAdapter = new TalonOneIntegrationAdapter();
