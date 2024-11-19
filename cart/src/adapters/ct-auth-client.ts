// server/adapters/ct-auth-client.ts

import { readConfiguration } from "../utils/config.utils";
import { resolveUrl } from "../utils/url.util";

export default class CommercetoolsAuthClient {
	private projectKey: string;
	private authUrl: string;
	private bffCtpClientId: string;
	private bffCtpClientSecret: string;

	constructor() {
		this.projectKey = readConfiguration().ctpProjectKey as string;
		this.authUrl = readConfiguration().ctpAuthUrl as string;
		this.bffCtpClientId = readConfiguration().bffCtpClientId as string;
		this.bffCtpClientSecret = readConfiguration().bffCtpClientSecret as string;
		// console.log('this.bffCtpClientId', this.bffCtpClientId);
		// console.log('this.bffCtpClientSecret', this.bffCtpClientSecret);
	}

	/**
	 * Obtains an access token for an anonymous session.
	 * @returns A promise that resolves to the access token string.
	 */
	async getAnonymousSession(): Promise<any> {
		const url = resolveUrl(this.authUrl, 'oauth', this.projectKey, 'anonymous/token');

		const credentials = Buffer.from(`${this.bffCtpClientId}:${this.bffCtpClientSecret}`).toString('base64');

		const body = new URLSearchParams();
		body.append('grant_type', 'client_credentials');

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Basic ${credentials}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: body.toString(),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					`Failed to obtain anonymous token: ${response.statusText}, ${JSON.stringify(errorData)}`
				);
			}

			const data = await response.json();
			return data;
		} catch (error: any) {
			throw new Error(`Failed to obtain anonymous token: ${error.message}`);
		}
	}

	/**
   * Refreshes the anonymous token using the provided refresh token.
   * @param refreshToken - The refresh token to use for renewing the access token.
   * @returns A promise that resolves to the new access token data.
   */
	async renewAnonymousToken(refreshToken: string): Promise<any> {
		const url = resolveUrl(this.authUrl, 'oauth', 'token');

		const credentials = Buffer.from(`${this.bffCtpClientId}:${this.bffCtpClientSecret}`).toString('base64');

		const body = new URLSearchParams();
		body.append('grant_type', 'refresh_token');
		body.append('refresh_token', refreshToken);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Basic ${credentials}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: body.toString(),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					`Failed to refresh anonymous token: ${response.statusText}, ${JSON.stringify(errorData)}`,
				);
			}

			const data = await response.json();
			return data;
		} catch (error: any) {
			throw new Error(`Failed to refresh anonymous token: ${error.message}`);
		}
	}

	/**
 * Introspects the token to verify its validity.
 * @param token - The access token to introspect.
 * @returns A promise that resolves to the token introspection result.
 */
	async introspectToken(token: string): Promise<any> {
		const url = resolveUrl(this.authUrl, 'oauth', 'introspect');

		const credentials = Buffer.from(`${this.bffCtpClientId}:${this.bffCtpClientSecret}`).toString('base64');

		const body = new URLSearchParams();
		body.append('token', token);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Basic ${credentials}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: body.toString(),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					`Failed to introspect token: ${response.statusText}, ${JSON.stringify(errorData)}`
				);
			}

			const data = await response.json();
			return data;
		} catch (error: any) {
			throw new Error(`Failed to introspect token: ${error.message}`);
		}
	}

	// Not yet implemented.
	async getCustomerToken(username: string, password: string): Promise<any> { }
}
