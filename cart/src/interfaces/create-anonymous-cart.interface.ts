// cart/src/interfaces/create-anonymous-cart.interface.ts

import { CART_JOURNEYS } from "../constants/cart.constant";

export interface CreateAnonymousCartInput {
    campaignGroup: string;
    journey: CART_JOURNEYS;
    locale?: string;
}