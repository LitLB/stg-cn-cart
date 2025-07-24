import dayjs from "dayjs";
import { Characteristic } from "../interfaces/otp.interface";
import { ICheckCustomerProfileResponse } from "../interfaces/validate-response.interface";
import { convertToDDMMYYYY } from "../utils/formatter.utils";
import { formatCertificateType } from "./helpers.validators";
import { STATUS_MESSAGES, STATUS_CODES } from "../constants/http.constant";
import { logger } from "../utils/logger.utils";


export const validateCustomerDtacProfile = (data: any): ICheckCustomerProfileResponse => {

    let pricePlan
    const date = new Date()
    const NXCL_FLAG = data.characteristic.find((a: Characteristic) => a.name === "NXCL_FLAG")
    const aging = data.characteristic.find((row: Characteristic) => row.name === "TOTL_DAYS").value
    const customerType = data.characteristic.find((a: Characteristic) => a.name === "CS_CUST__OCCP_CODE").value
    const filteredAging = data.characteristic.find((a: Characteristic) => a.name === "TOTL_DAYS").value

    if (!NXCL_FLAG || !aging || !customerType) {
        logger.error("Missing required fields in customer profile data");
        throw {
            statusCode: STATUS_CODES.GET_PROFILE_INFO_FAIL,
            statusMessage: STATUS_MESSAGES.GET_PROFILE_INFO_FAIL,
        }
    }

    if (customerType.value === "902") {
        throw {
            statusCode: STATUS_CODES.CUSTOMER_TYPE_NOT_ELIGIBLE,
            statusMessage: STATUS_MESSAGES.CUSTOMER_TYPE_NOT_ELIGIBLE,
        }
    }

    if (NXCL_FLAG === "Y") {
        throw {
            statusCode: STATUS_CODES.NUMBER_CANCELLED_OR_PREPAID_SWITCH,
            statusMessage: STATUS_MESSAGES.NUMBER_CANCELLED_OR_PREPAID_SWITCH,
        }
    }

    if (data.subscriberInfo.status.code === "S") {
        throw {
            statusCode: STATUS_CODES.CUSTOMER_SUSPENDED,
            statusMessage: STATUS_MESSAGES.CUSTOMER_SUSPENDED,
        }
    }

    // ! ทาง DTAC แจ้งว่าไม่สามารถ return ค่านี้ได้
    // if (data.subscriberInfo.status.code !== "A") {
    //     throw {
    //         statusCode: '400.4019',
    //         statusMessage: 'Customer status is not active',
    //     }
    // }

    if (data.subscriberInfo.telType !== "T") {
        throw {
            statusCode: STATUS_CODES.SUBSCRIBER_TYPE_NOT_POSTPAID,
            statusMessage: STATUS_MESSAGES.SUBSCRIBER_TYPE_NOT_POSTPAID,
        }
    }

    if (Number(aging) < 90) {
        throw {
            statusCode: STATUS_CODES.AGE_OF_USE_DOES_NOT_MEET_CRITERIA,
            statusMessage: STATUS_MESSAGES.AGE_OF_USE_DOES_NOT_MEET_CRITERIA,
        }
    }

    const packageInfo = data.productOfferingQualificationItem.find((element: any) => {
        return element.productItem.find((item: any) => {
            return item.type === "10" && (item.validFor.endDateTime === null || item.validFor.endDateTime > date) && parseFloat(item.itemPrice.price.value) > 0
        })
    });


    if (packageInfo) {
        pricePlan = packageInfo.productItem.find((item: any) => {
            return item.type === "10" && (item.validFor.endDateTime === null || item.validFor.endDateTime > date) && parseFloat(item.itemPrice.price.value) > 0
        })
    }

    return {
        certificationId: data.engagedParty.id,
        certificationType: formatCertificateType(data.engagedParty.type || '01'), // ! TBC
        customerNo: data.relatedParty.href,
        customerType: customerType,
        companyCode: "DTN", // ? FIX
        birthOfDate: convertToDDMMYYYY(data.subscriberInfo.birthDate),
        aging: filteredAging,
        pricePlan: (pricePlan?.itemPrice.price.value ?? undefined),
        packageCode: (pricePlan?.id ?? undefined)
    }

}



export const validateCustomerTrueProfile = (data: any): ICheckCustomerProfileResponse => {

    if (!["I", "X", "P"].includes(data.relatedParty.customer.type)) {
        throw {
            statusCode: STATUS_CODES.CUSTOMER_TYPE_NOT_ELIGIBLE,
            statusMessage: STATUS_MESSAGES.CUSTOMER_TYPE_NOT_ELIGIBLE,
        }
    }

    if ((data.subscriberInfo.status.code === "A" && data.subscriberInfo.status.description === "Soft Suspend") || (data.subscriberInfo.status.code == "S")) {
        throw {
            statusCode: STATUS_CODES.CUSTOMER_SUSPENDED,
            statusMessage: STATUS_MESSAGES.CUSTOMER_SUSPENDED,
        }
    }


    // ! TRUE บอกว่าไม่มีเคสนี้
    // if (data.subscriberInfo.status.code !== "A") {
    //     throw {
    //         statusCode: '400.4019',
    //         statusMessage: 'Customer status is not active',
    //         errorCode: 'CUSTOMER_STATUS_IS_NOT_ACTIVE'
    //     }
    // }

    if (data.productInfo?.installationType && data.productInfo?.installationType === "FSIM") {
        throw {
            statusCode: STATUS_CODES.PACKAGE_IS_SHARE_PLAN,
            statusMessage: STATUS_MESSAGES.PACKAGE_IS_SHARE_PLAN,
        }
    }

    data.characteristic.forEach((element: { name: string; value: string }) => {
        if (element.name === 'installmentType' && element.value === 'FSIM') {
            throw {
                statusCode: STATUS_CODES.PACKAGE_IS_SHARE_PLAN,
                statusMessage: STATUS_MESSAGES.PACKAGE_IS_SHARE_PLAN,
            }
        }

        if (element.name === 'system' && element.value !== "CCBS") {
            throw {
                statusCode: STATUS_CODES.SUBSCRIBER_TYPE_NOT_POSTPAID,
                statusMessage: STATUS_MESSAGES.SUBSCRIBER_TYPE_NOT_POSTPAID,
            }
        }
    });



    if (Number(data.aging) < 90) {
        throw {
            statusCode: STATUS_CODES.AGE_OF_USE_DOES_NOT_MEET_CRITERIA,
            statusMessage: STATUS_MESSAGES.AGE_OF_USE_DOES_NOT_MEET_CRITERIA,
        }
    }

    if (data.subscriberInfo.status.code === "A" && data.subscriberInfo.status.description !== "Soft Suspend") {

        const companyCode = data.characteristic.find((element: any) => element.name === 'companyCode')
        const packageInfo = data.productOfferingQualificationItem.find((element: any) => {
            return element.productItem.find((item: any) => {
                return item.type === "P" && item.status === "A"
            })
        });

        const foundPackage = packageInfo.productItem.find((element: any) => element.type === 'P' && element.status === 'A')

        /* 
            True : ID Card Type
            C=หนังสือรับรองบริษัท/ห้างฯ
            G=บัตรประจำตัวข้าราชการ
            M=ใบสุทธิ
            P=หนังสือเดินทาง
            T=ทะเบียนวัด
            I=บัตรประชาชน                   
            J=หนังสือรับรองการจัดตั้งสมาคม
            B=บัญชีมูลนิธิ
            O=ทะเบียนพาณิชย์
            D=บัตรประจำตัวพนักงานรัฐวิสาหกิจ
            A=บัตรประจำตัวคนต่างด้าว
            H=อื่นๆ
            F=บัตรนักเรียน-นักศึกษา
            E=ใบขับขี่
            S=TempPassportบัตรไม่ระบุสัญชาติ
            V=รหัสหน่วยงานราชการ/รัฐวิสาหกิจ
        */

        return {
            certificationId: data.engagedParty.id,
            certificationType: data.engagedParty.type,
            customerNo: data.relatedParty.account.id,
            customerType: data.relatedParty.customer.type,
            companyCode: companyCode.value,
            agreementId: data.subscriberInfo.id,
            birthOfDate: convertToDDMMYYYY(data.subscriberInfo.birthDate),
            aging: data.aging,
            pricePlan: (foundPackage.amount.value ?? undefined),
            packageCode: (foundPackage.name ?? undefined)
        }

    } else {
        throw {
            statusCode: STATUS_CODES.GET_PROFILE_INFO_FAIL,
            statusMessage: STATUS_MESSAGES.GET_PROFILE_INFO_FAIL,
        }
    }

}

export const validateContractAndQuotaTrue = (data: any) => {
    const product = data.product
    const now = dayjs()
    const filteredProduct = product.map((item: any) => {
        if (parseInt(item.fee) > 0 && parseInt(item.term) > 0) {
            return {
                contractTerm: parseInt(item.term),
                contractFee: parseInt(item.fee),
                contractRemain: dayjs(item.contractExpirationDate).diff(now, "day")
            }
        }

    })

    filteredProduct.forEach((item: { contractTerm: number, contractFee: number, contractRemain: number }) => {

        if (item.contractTerm > 0 && item.contractFee >= 0 && item.contractRemain <= 90) return { contractRemainDays: String(item.contractRemain) }
        else if (item.contractTerm > 0 && item.contractFee > 0 && item.contractRemain > 90) {
            throw {
                statusCode: STATUS_CODES.NOT_ALLOWED_TO_EXTEND_CONTRACT,
                statusMessage: STATUS_MESSAGES.NOT_ALLOWED_TO_EXTEND_CONTRACT,
            }
        } else {
            throw {
                statusCode: STATUS_CODES.NOT_ALLOWED_TO_EXTEND_CONTRACT,
                statusMessage: STATUS_MESSAGES.NOT_ALLOWED_TO_EXTEND_CONTRACT,
            }
        }
    })

}

export const validateContractAndQuotaDtac = (data: any) => {

    const allowFlag = data.characteristic.find((r: Characteristic) => r.name === "AllowFlag").value === "Y"
    const quotaStatusFlag = data.characteristic.find((r: Characteristic) => r.name === "QuotaStatus").value === "Y"
    const totalContractActiveFlag = data.characteristic.find((r: Characteristic) => r.name === "TotalActiveContract").value === "0"

    if (allowFlag || (!allowFlag && quotaStatusFlag && totalContractActiveFlag)) {
        return {
            contractRemainDays: '0' // ? DEFAULT "0" not exist in DTAC
        }
    } else {
        throw {
            statusCode: STATUS_CODES.NOT_ALLOWED_TO_EXTEND_CONTRACT,
            statusMessage: STATUS_MESSAGES.NOT_ALLOWED_TO_EXTEND_CONTRACT,
        }
    }
}

export const validateSharePlan = (data: any) => {
    if (data.account[0].type === "P") {
        throw {
            statusCode: STATUS_CODES.PACKAGE_IS_SHARE_PLAN,
            statusMessage: STATUS_MESSAGES.PACKAGE_IS_SHARE_PLAN,
        }
    }
}