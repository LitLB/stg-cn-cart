// src/services/auth.service.ts

import CommercetoolsAuthClient from '../adapters/ct-auth-client';
import { calculateExpiration } from '../utils/session-utils';

export class AuthService {
    private commercetoolsAuthClient: CommercetoolsAuthClient;

    constructor() {
        this.commercetoolsAuthClient = new CommercetoolsAuthClient();
    }

    public createAnonymousSession = async () => {
        try {
            const anonymousSession = await this.commercetoolsAuthClient.getAnonymousSession();

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

    public renewAnonymousSession = async (refreshToken: string) => {
        try {
            const newTokenData = await this.commercetoolsAuthClient.renewAnonymousToken(refreshToken);

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
