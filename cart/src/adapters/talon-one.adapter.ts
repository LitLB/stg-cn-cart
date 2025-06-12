import * as talonOne from "talon_one";
import { readConfiguration } from "../utils/config.utils";
import { HTTP_STATUSES } from "../constants/http.constant";
import { ApiResponse } from "../interfaces/response.interface";
import { logger } from "../utils/logger.utils";
import { validateCouponLimit } from "../validators/coupon.validator";

export class TalonOneIntegrationAdapter {
	public readonly name = 'talonOneIntegrationAdapter' as const
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

	updateCustomerSession(
		customerSessionId: string,
		payload: any,
		opt?: any
	) {
		return this.integrationApi.updateCustomerSessionV2(
			customerSessionId,
			payload,
			opt
		);
	}

	buildCustomerSessionPayload({
		profileId = 'guest',
		state,
		couponCodes = [],
	}: {
		profileId?: string
		state?: any
		couponCodes?: string[]
	} = {}) {

		return {
			customerSession: {
				profileId,
				...(state ? { state } : {}),
				cartItems: [],
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
			return {
				applyCoupons: [], error: {
					statusCode: HTTP_STATUSES.BAD_REQUEST,
					errorCode: "APPLIYED_COUPON_CT_FAILED",
					statusMessage: `No products found.`,
				}
			};
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

		removeCouponCodes = [...removeCouponCodes, ...removeCodeEff]
		// Validate coupon limit
		const validationError = await validateCouponLimit(applyCoupons.length);
		if (validationError) {
			return { applyCoupons: [], error: validationError };
		}

		// Remove invalid coupons from applyCoupons
		if (removeCouponCodes.length > 0) {
			applyCoupons = applyCoupons.filter(item => !removeCouponCodes.includes(item));
		}

		return { applyCoupons, error: undefined };
	}
}

export const talonOneIntegrationAdapter = new TalonOneIntegrationAdapter();
