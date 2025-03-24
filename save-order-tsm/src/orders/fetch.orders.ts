import { OrderPagedQueryResponse } from '@commercetools/platform-sdk';
import { getAll } from './modifier.order';
import { GetFunction } from '../types/index.types';
import { getOrders } from '../services/commercetools.service';

export const allOrders: GetFunction<OrderPagedQueryResponse> = getAll(getOrders);