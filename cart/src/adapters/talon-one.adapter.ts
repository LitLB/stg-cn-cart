import * as talonOne from "talon_one";
import { readConfiguration } from "../utils/config.utils";

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

	getCustomerSession(customerSessionId: string) {
		return this.integrationApi.getCustomerSession(customerSessionId);
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
					price: 0,
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
}

export const talonOneIntegrationAdapter = new TalonOneIntegrationAdapter();
