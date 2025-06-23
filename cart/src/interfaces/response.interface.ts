// cart/src/interfaces/response.interface.ts

import { HTTP_STATUSES } from "../constants/http.constant";

export interface ApiResponse<T = any> {
    statusCode: HTTP_STATUSES;
    statusMessage: string;
    errorCode?: string;
    message?: string;
    data?: T;
}

export interface IHeadlessCheckEligibleResponse {
    productBundleKey: string;
    contractTerm: number;
    contractFee: number;
    campaignByJourney: string;
    prices: {
        rrp: number;
        totalDiscount: number;
        discounted: number;
        discounts: {
            group: string;
            type: string;
            code: string;
            amount: number;
        }[];
    };
}