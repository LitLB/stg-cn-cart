// src/services/auth.service.ts

import CommercetoolsAuthClient from '../adapters/ct-auth-client';
import { calculateExpiration } from '../utils/session-utils';

export class AuthService {
    private authClient: CommercetoolsAuthClient;

    constructor() {
        this.authClient = new CommercetoolsAuthClient();
    }
    /**
      * Creates an anonymous session with Commercetools.
      * @returns An object containing session details and expiration times.
      */
    public async createAnonymousSession() {
        try {
            const anonymousSession = await this.authClient.getAnonymousSession();

            const { expires_in } = anonymousSession;

            const expiredAt = calculateExpiration(expires_in);
            const expiredAtWithBuffer = calculateExpiration(expires_in, 300);

            return {
                ...anonymousSession,
                expiredAt,
                expiredAtWithBuffer,
            };
        } catch (error: any) {
            console.error('Error in AuthService.createAnonymousSession:', error);
            throw error;
        }
    }

    /**
     * Renews an anonymous session using the provided refresh token.
     * @param refreshToken - The refresh token to use for renewing the access token.
     * @returns An object containing the new session details and expiration times.
     */
    public async renewAnonymousSession(refreshToken: string) {
        try {
            const newTokenData = await this.authClient.renewAnonymousToken(refreshToken);

            const { expires_in } = newTokenData;

            const expiredAt = calculateExpiration(expires_in);
            const expiredAtWithBuffer = calculateExpiration(expires_in, 300);

            return {
                ...newTokenData,
                expiredAt,
                expiredAtWithBuffer,
            };
        } catch (error: any) {
            console.error('Error in AuthService.renewAnonymousSession:', error);
            throw error;
        }
    }
}
