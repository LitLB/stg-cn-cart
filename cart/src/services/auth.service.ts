// src/services/auth.service.ts

import CommercetoolsAuthClient from '../adapters/ct-auth-client';
import { formatError, generateFailedErrorCode, generateFailedStatusMessage } from '../utils/error.utils';
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
            throw formatError(error, 'createAnonymousSession');
        }
    }

    public renewAnonymousSession = async (body: any) => {
        try {
            const { refreshToken } = body;
            if (!refreshToken) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Refresh token is required.',
                }
            }

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
            throw formatError(error, 'renewAnonymousSession');
        }
    }
}

