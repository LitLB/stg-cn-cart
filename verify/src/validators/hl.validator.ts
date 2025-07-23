// verify/src/validators/hl.validator.ts

import { STATUS_CODES } from "../constants/http.constant";

export class HLValidator {
    public static handleVerifyHLStatus = (code: string) => {
        switch (code) {
            case "101":
                return {
                    statusCode: STATUS_CODES.INVALID_LOCK_3_STEP,
                    statusMessage: 'Invalid lock 3 step',
                    errorCode: 'INVALID_LOCK_3_STEP'
                }
            case "102":
                return {
                    statusCode: STATUS_CODES.CUSTOMER_FRAUD_FLAGGED,
                    statusMessage: 'Customer fraud flagged',
                    errorCode: 'CUSTOMER_FRAUD_FLAGGED'
                }
            case "103":
                return {
                    statusCode: STATUS_CODES.BLACKLISTED_CUSTOMER_NOT_ALLOWED,
                    statusMessage: 'Black listed customer is not allowed',
                    errorCode: 'BLACK_LIST_CUSTOMER_IS_NOT_ALLOWED'
                }
            case "104":
                return {
                    statusCode: STATUS_CODES.CUSTOMER_IN_COLLECTION,
                    statusMessage: 'Customer in collection',
                    errorCode: 'CUSTOMER_IN_COLLECTION'
                }
            case "105":
                return {
                    statusCode: STATUS_CODES.OVER_MAX_ALLOW_6_NUMBER,
                    statusMessage: 'Over max allow (6 number)',
                    errorCode: 'OVER_MAX_ALLOW_6_NUMBER'
                }
            case "106":
                return {
                    statusCode: STATUS_CODES.INVALID_ACTIVATED_LESS_THAN_45_DAYS,
                    statusMessage: 'Invalid activated less than 45 days ago',
                    errorCode: 'INVALID_ACTIVATED_LESS_THEN_45_DAYS_AGO'
                }
            case "107":
                return {
                    statusCode: STATUS_CODES.UNDER_18_YEARS_OLD,
                    statusMessage: 'under 18 years old',
                    errorCode: 'UNDER_18_YEARS_OLD'
                }
            case "116":
                return {
                    statusCode: STATUS_CODES.NBTC_1_ID_5_NUMBER,
                    statusMessage: 'NBTC 1 ID 5 Number',
                    errorCode: 'NBTC_1_ID_5_NUMBER'
                }
            default:
                return;
        }
    }
}