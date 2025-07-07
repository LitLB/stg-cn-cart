import dayjs from "dayjs";
import { Characteristic } from "../interfaces/otp.interface";
import { ICheckCustomerProfileResponse } from "../interfaces/validate-response.interface";
import { convertToDDMMYYYY } from "../utils/formatter.utils";


export const validateCustomerDtacProfile = (data: any): ICheckCustomerProfileResponse => {
    const date = new Date()

    if (!data.characteristic[26] || !data.characteristic[28]) {
        throw {
            statusCode: '400.4017',
            statusMessage: 'Customer type is not eligible',
            errorCode: 'CUSTOMER_TYPE_IS_NOT_NOT_ELIGIBLE'
        }
    }

    if (data.characteristic[26]?.name === "CS_CUST__OCCP_COD" && data.characteristic[26]?.value === "902") {
        throw {
            statusCode: '400.4017',
            statusMessage: 'Customer type is not eligible',
            errorCode: 'CUSTOMER_TYPE_IS_NOT_NOT_ELIGIBLE'
        }
    }

    if (data.characteristic[28].name === "NXCL_FLAG" && data.characteristic[28].value === "Y") {
        throw {
            statusCode: '400.4023',
            statusMessage: 'This number requested service cancellation or switch from a postpaid to a prepaid plan',
            errorCode: 'THIS_NUMBER_REQUESTED_SERVICE_CANCELLATION_OR_SWITCH_FROM_A_POSTPAID_TO_A_PREPAID_PLAN'
        }
    }

    if (data.subscriberInfo.status.code === "S") {
        throw {
            statusCode: '400.4020',
            statusMessage: 'Customer is suspended',
            errorCode: 'CUSTOMER_IS_SUSPENDED'
        }
    }

    // ! ทาง DTAC แจ้งว่าไม่สามารถ return ค่านี้ได้
    // if (data.subscriberInfo.status.code !== "A") {
    //     throw {
    //         statusCode: '400.4019',
    //         statusMessage: 'Customer status is not active',
    //         errorCode: 'CUSTOMER_STATUS_IS_NOT_ACTIVE'
    //     }
    // }

    if (data.subscriberInfo.telType !== "T") {
        throw {
            statusCode: '400.4011',
            statusMessage: 'Subscriber type is not postpaid',
            errorCode: 'SUBSCRIBER_TYPE_IS_NOT_POSTPAID'
        }
    }

    const aging = data.characteristic.find((row: Characteristic) => row.name === "TOTL_DAYS").value


    if (Number(aging) < 90) {
        throw {
            statusCode: "400.4034",
            statusMessage: "The age of use does not meet the required criteria"
        }
    }

    const customerType = data.characteristic.find((a: any) => a.name === "CS_CUST__OCCP_CODE").value
    const filteredAging = data.characteristic.find((a: any) => a.name === "TOTL_DAYS").value


    const packageInfo = data.productOfferingQualificationItem.find((element: any) => {
        return element.productItem.find((item: any) => {
            return item.type === "10" && (item.validFor.endDateTime === null || item.validFor.endDateTime > date) && parseFloat(item.itemPrice.price.value) > 0
        })
    });

    let pricePlan
    if (packageInfo) {
        pricePlan = packageInfo.productItem.find((item: any) => {
            return item.type === "10" && (item.validFor.endDateTime === null || item.validFor.endDateTime > date) && parseFloat(item.itemPrice.price.value) > 0
        })
    }


    return {
        certificationId: data.engagedParty.id,
        certificationType: data.relatedParty.customer?.type || 'I', // ! TBC
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
            statusCode: '400.4017',
            statusMessage: 'Customer type is not eligible',
            errorCode: 'CUSTOMER_TYPE_IS_NOT_ELIGIBLE'
        }
    }

    if ((data.subscriberInfo.status.code === "A" && data.subscriberInfo.status.description === "Soft Suspend") || (data.subscriberInfo.status.code == "S")) {
        throw {
            statusCode: '400.4020',
            statusMessage: 'Customer is suspended',
            errorCode: 'CUSTOMER_IS_SUSPENDED'
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
            statusCode: '400.4021',
            statusMessage: 'Package is share plan',
            errorCode: 'PACKAGE_IS_SHARE_PLAN'
        }
    }

    data.characteristic.forEach((element: { name: string; value: string }) => {
        if (element.name === 'installmentType' && element.value === 'FSIM') {
            throw {
                statusCode: '400.4021',
                statusMessage: 'Package is share plan',
                errorCode: 'PACKAGE_IS_SHARE_PLAN'
            }
        }

        if (element.name === 'system' && element.value !== "CCBS") {
            throw {
                statusCode: '400.4011',
                statusMessage: 'Subscriber type is not postpaid',
                errorCode: 'SUBSCRIBER_TYPE_IS_NOT_POSTPAID'
            }
        }
    });



    if (Number(data.aging) < 90) {
        throw {
            statusCode: "400.4034",
            statusMessage: "The age of use does not meet the required criteria",
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
            certificationType: data.relatedParty.customer.type,
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
            statusCode: '400.4010',
            statusMessage: 'Get profile info fail',
            errorCode: 'GET_PROFILE_INFO_FAIL'
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
                statusCode: '400.4013',
                statusMessage: 'Not allowed to extend contract',
                errorCode: 'NOT_ALLOWED_TO_EXTERNAL_CONTRACT'
            }
        } else {
            throw {
                statusCode: '400.4013',
                statusMessage: 'Not allowed to extend contract',
                errorCode: 'NOT_ALLOWED_TO_EXTERNAL_CONTRACT'
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
            statusCode: '400.4013',
            statusMessage: 'Not allowed to extend contract',
            errorCode: 'NOT_ALLOWED_TO_EXTERNAL_CONTRACT'
        }
    }
}

export const validateSharePlan = (data: any) => {
    if (data.account[0].type === "P") {
        throw {
            statusCode: '400.4021',
            statusMessage: 'Package is share plan',
            errorCode: 'PACKAGE_IS_SHARE_PLAN'
        }
    }
}