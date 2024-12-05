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
