import { ApiResponse } from "../interfaces/response.interface"

export const validateCustomerDtacProfile = (data: any): Partial<void | ApiResponse> => {

    if (data.characteristic[26].name === "CS_CUST__OCCP_COD" && data.characteristic[26].value === "902") {
        throw {
            statusCode: 400,
            statusMessage: 'Customer type is not eligible',
            errorCode: 'CUSTOMER_TYPE_IS_NOT_NOT_ELIGIBLE'
        }
    }

    if (data.characteristic[28].name === "NXCL_FLAG" && data.characteristic[28].value === "Y") {
        throw {
            statusCode: 400,
            statusMessage: 'This number requested service cancellation or switch from a postpaid to a prepaid plan',
            errorCode: 'THIS_NUMBER_REQUESTED_SERVICE_CANCELLATION_OR_SWITCH_FROM_A_POSTPAID_TO_A_PREPAID_PLAN'
        }
    }

    if (data.subscriberInfo.status.code === "S") {
        throw {
            statusCode: 400,
            statusMessage: 'Customer is suspended',
            errorCode: 'CUSTOMER_IS_SUSPENDED'
        }
    }

    if (data.subscriberInfo.status.code !== "A") {
        throw {
            statusCode: 400,
            statusMessage: 'Customer status is not active',
            errorCode: 'CUSTOMER_STATUS_IS_NOT_ACTIVE'
        }
    }

    //todo: share plan 
    //! implement this after have solution
    // if(condition){ 
    //     throw {
    //         statusCode: 400,
    //         statusMessage: 'Customer is sharing plan',
    //         errorCode: 'CUSTOMER_IS_SHARING_PLAN'
    //     }
    // }

    if (data.subscriberInfo.telType !== "T") {
        throw {
            statusCode: 400,
            statusMessage: 'Subscriber type is not postpaid',
            errorCode: 'SUBSCRIBER_TYPE_IS_NOT_POST_POSTPAID'
        }
    }

}