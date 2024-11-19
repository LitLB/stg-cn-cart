import {
	ApiRoot,
	createApiBuilderFromCtpClient,
} from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/sdk-client-v2';
import { createAuthMiddlewareForClientCredentialsFlow } from '@commercetools/sdk-middleware-auth';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';

class CommercetoolsBaseClient {
	private static instance: CommercetoolsBaseClient;
	private apiRoot: ApiRoot;
	private projectKey: string;
	private authUrl: string;
	private apiUrl: string;
	private clientId: string;
	private clientSecret: string;

	private constructor() {
		const config = useRuntimeConfig();
		this.projectKey = config.public.ctpProjectKey as string;
		this.authUrl = config.public.ctpAuthUrl as string;
		this.apiUrl = config.public.ctpApiUrl as string;
		this.clientId = config.ctpClientId as string;
		this.clientSecret = config.ctpClientSecret as string;

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
