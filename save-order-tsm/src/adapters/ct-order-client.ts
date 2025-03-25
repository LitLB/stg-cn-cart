import type { ApiRoot, Order, OrderChangeOrderStateAction, OrderPagedQueryResponse, OrderChangeShipmentStateAction, OrderSetCustomFieldAction, OrderTransitionStateAction, OrderUpdate, State } from '@commercetools/platform-sdk';
import CommercetoolsBaseClient from './ct-base-client';
import { readConfiguration } from '../utils/config.utils';
import { LOG_APPS, LOG_MSG} from '../constants/log.constant';
import { createLogModel, LogModel} from '../utils/logger.utils';
import { createApiRoot } from '../client/create.client.js'
import _ from 'lodash';
import { logger } from '../utils/logger.utils'

const apiRoot = createApiRoot()

export class CommercetoolsOrderClient {
	private apiRoot: ApiRoot;
	private projectKey: string;

	constructor() {
		this.apiRoot = CommercetoolsBaseClient.getApiRoot();
		this.projectKey = readConfiguration().ctpProjectKey as string;
	}

	public async getOrderById(orderId: string) {		
		const response = await this.apiRoot
		.withProjectKey({ projectKey: this.projectKey })
		.orders()
		.withId({ ID: orderId })
		.get({
			queryArgs: {
				expand: 'state',
			},
		})
		.execute();

		return response.body;
	}

	public async getOrder (search: string, limit = 100, offset = 0, sort='createdAt desc') : Promise<OrderPagedQueryResponse> {
		const logModel = LogModel.getInstance();
		const logStepModel = createLogModel(LOG_APPS.STG_CN_CART, LOG_MSG.ORDER_UPDATE, logModel);
		let result!: OrderPagedQueryResponse;
		try {
			const { body } = await apiRoot
				.orders()
				.get({
					queryArgs: { 
						where: search,
						limit: Number(limit),
						offset: Number(offset),
						sort: sort
					},
				})
				.execute()
	
			return body;
		} catch (error) {
			logStepModel.logFailure({ search }, `${error}`);
			return result;
		}
	}

	public async buildUpdateOrderTransitionState(order: Order, stateKey: string, orderState = '') {
		const stateInfo = await this.getStateByKey(stateKey);
		const stateId = _.get(stateInfo, 'id');
		const update: OrderTransitionStateAction = {
			action: 'transitionState',
			state: {
				typeId: 'state',
				id: stateId
			}
		}

		const payload: OrderUpdate = {
			version: order?.version,
			actions: [update]
		}

		if (!_.isEmpty(orderState)) {
			const updateOrderState: OrderChangeOrderStateAction = {
				action: 'changeOrderState',
				orderState: orderState,
			}
			payload.actions.push(updateOrderState);
		}

		return payload;
	}

	public async getStateByKey(key: string) {
		let result!: State;
		try {
			const { body } = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.states()
				.withKey({ key: key })
				.get()
				.execute()

			return body
		} catch (error) {
			return result;
		}
	}

	public async getOrderByOrderNumber(orderNumber: string): Promise<Order | undefined> {
        let result: Order | undefined;
        try {
            const { body } = await this.apiRoot
                .withProjectKey({ projectKey: this.projectKey })
                .orders()
                .withOrderNumber({ orderNumber: orderNumber })
                .get({
                    queryArgs: {
                        expand: ['state'],
                    },
                })
                .execute()
            logger.info(`getOrderByOrderNumber ${orderNumber} version ${body?.version || null}`);
            return body;
        } catch (error) {
            logger.error(`getOrderByOrderNumber ${orderNumber} ${error}`)
            return result;
        }
	}

	public async updateOrderById(orderId: string, payload: OrderUpdate): Promise<{ success: boolean; response: any }> {
		try {
			const { body } = await this.apiRoot
				.withProjectKey({ projectKey: this.projectKey })
				.orders()
				.withId({ ID: orderId })
				.post({
					body: payload
				})
				.execute()

			return { success: true, response: body };
		} catch (error) {
			return { success: false, response: error };
		}
	}

	public async getOrderFromQuery (query : string): Promise<Order[]> {
		try {
			const { body } = await apiRoot
				.orders()
				.get({
					queryArgs: {
						where: query,
						expand: [
							"custom.fields.couponsInfomation",
						],
						sort: ["lastModifiedAt ASC"],
						limit: 5,
					}
				})
				.execute()
	
			return body.results
		} catch (error) {
			logger.error(`Get orders ${error} Body Query : ${query}`)
			return []
		}
	}
}

export const commercetoolsOrderClient = new CommercetoolsOrderClient();
