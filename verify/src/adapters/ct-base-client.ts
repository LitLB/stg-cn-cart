import {
	ApiRoot,
	createApiBuilderFromCtpClient,
} from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/sdk-client-v2';
import { readConfiguration } from '../utils/config.utils';
import createHttpMiddleware from '@commercetools/sdk-client-v2/dist/declarations/src/sdk-middleware-http/http';
import createAuthMiddlewareForClientCredentialsFlow from '@commercetools/sdk-client-v2/dist/declarations/src/sdk-middleware-auth/client-credentials-flow';


class CommercetoolsBaseClient {
	private static instance: CommercetoolsBaseClient;
	private apiRoot: ApiRoot;
	private projectKey: string;
	private authUrl: string;
	private apiUrl: string;
	private clientId: string;
	private clientSecret: string;

	private constructor() {
		this.projectKey = readConfiguration().ctpProjectKey as string;
		this.authUrl = readConfiguration().ctpAuthUrl as string;
		this.apiUrl = readConfiguration().ctpApiUrl as string;
		this.clientId = readConfiguration().ctpClientId as string;
		this.clientSecret = readConfiguration().ctpClientSecret as string;

		const client = new ClientBuilder()
			.withProjectKey(this.projectKey)
			.withMiddleware(
				createAuthMiddlewareForClientCredentialsFlow({
					host: this.authUrl,
					projectKey: this.projectKey,
					credentials: {
						clientId: this.clientId,
						clientSecret: this.clientSecret,
					},
					scopes: [`manage_project:${this.projectKey}`],
				})
			)
			.withMiddleware(
				createHttpMiddleware({
					host: this.apiUrl,
				})
			)
			.build();

		this.apiRoot = createApiBuilderFromCtpClient(client);
	}

	public static getInstance(): CommercetoolsBaseClient {
		if (!CommercetoolsBaseClient.instance) {
			CommercetoolsBaseClient.instance = new CommercetoolsBaseClient();
		}
		return CommercetoolsBaseClient.instance;
	}

	public getApiRoot(): ApiRoot {
		return this.apiRoot;
	}
}

export default CommercetoolsBaseClient.getInstance();
