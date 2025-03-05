import { Characteristic } from "../interfaces/otp.interface";
import { ApiResponse } from "../interfaces/response.interface"
import { ICheckCustomerProfileResponse } from "../interfaces/validate-response.interface";


export const validateCustomerDtacProfile = (data: any): Partial<ICheckCustomerProfileResponse | ApiResponse> => {

    const date = new Date()

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

    const aging = data.characteristic.find((row: Characteristic) => row.name === "TOTL_DAYS").value
    const pricePlan = data.productOfferingQualificationItem.find((element: any) => {
        return element.productItem.find((item: any) => item.type === "10" && (item.validFor.endDateTime === null || item.validFor.endDateTime > date) && item.itemPrice.value > 0)
    });

    return {
        thaiId: data.engagedParty.id,
        customerNo: data.relatedParty.href,
        aging,
        pricePlan: pricePlan ?? null
    }

}

export const validateCustomerTrueProfile = (data: any): Partial<ICheckCustomerProfileResponse | ApiResponse> => {


    if (!data.relatedParty.customer.type.include(["I", "X", "P"])) {
        throw {
            statusCode: 400,
            statusMessage: 'Customer type is not eligible',
            errorCode: 'CUSTOMER_TYPE_IS_NOT_ELIGIBLE'
        }
    }

    if ((data.subscriberInfo.status.code === "A" && data.subscriberInfo.status.description === "Soft Suspend") || (data.subscriberInfo.status.code == "S")) {
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

    if (data.characteristic.name === "installmentType" && data.characteristic.value === "FSIM") {
        throw {
            statusCode: 400,
            statusMessage: 'Package is share plan',
            errorCode: 'PACKAGE_IS_SHARE_PLAN'
        }
    }

    if (data.characteristic.name === "system" && data.characteristic.value !== "CCBS") {
        throw {
            statusCode: 400,
            statusMessage: 'Subscriber type is not postpaid',
            errorCode: 'SUBSCRIBER_TYPE_IS_NOT_POSTPAID'
        }
    }

    if (data.subscriberInfo.status.code === "A" && data.subscriberInfo.status.description !== "Soft Suspend") {

        const pricePlan = data.productOfferingQualificationItem.find((element: any) => {
            return element.productItem.find((item: any) => item.type === "P" && item.status === "A")
        });

        return {
            thaiId: data.engagedParty.id,
            agreementId: data.subscriberInfo.id,
            customerNo: data.relatedParty.href,
            aging: data.aging,
            pricePlan: pricePlan ?? null
        }

    }

    throw {
        statusCode: 400,
        statusMessage: 'Get profile info fail',
        errorCode: 'GET_PROFILE_INFO_FAIL'
    }
}