// adapters/ct-state-client.ts

import type { ApiRoot, Order } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';

class CommercetoolsStateClient {
    private static instance: CommercetoolsStateClient;
    private apiRoot: ApiRoot;
    private projectKey: string;

    private constructor() {
        this.apiRoot = CommercetoolsBaseClient.getApiRoot();
        this.projectKey = readConfiguration().ctpProjectKey as string;
    }

    public static getInstance(): CommercetoolsStateClient {
        if (!CommercetoolsStateClient.instance) {
            CommercetoolsStateClient.instance = new CommercetoolsStateClient();
        }
        return CommercetoolsStateClient.instance;
    }

    /**
     * Transitions the state of an order.
     * @param orderId - The ID of the order to update.
     * @param currentVersion - The current version of the order.
     * @param newStateKey - The key of the new state to transition to.
     * @param force - Whether to force the transition regardless of defined transitions (default: false).
     */
    public async transitionOrderState(
        orderId: string,
        currentVersion: number,
        newStateKey: string,
        force = false,
    ): Promise<Order> {
        try {
            const response = await this.apiRoot
                .withProjectKey({ projectKey: this.projectKey })
                .orders()
                .withId({ ID: orderId })
                .post({
                    body: {
                        version: currentVersion,
                        actions: [
                            {
                                action: 'transitionState',
                                state: {
                                    typeId: 'state',
                                    key: newStateKey,
                                },
                                force: force,
                            },
                        ],
                    },
                })
                .execute();

            return response.body;
        } catch (error: any) {
            console.error('Error transitioning order state:', error);
            throw error;
        }
    }
}

export default CommercetoolsStateClient.getInstance();
