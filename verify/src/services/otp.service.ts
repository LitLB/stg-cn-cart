import moment from "moment";

import ApigeeClientAdapter from "../adapters/apigee-client.adapter";
import { readConfiguration } from "../utils/config.utils";
import { getOTPReferenceCodeFromArray } from "../utils/array.utils";
import { generateTransactionId } from "../utils/date.utils";
import { convertToThailandMobile } from "../utils/formatter.utils";
import { validateOperator } from "../utils/operator.utils";
import CommercetoolsCustomObjectClient from "../adapters/ct-custom-object-client"
import { getValueByKey } from "../utils/object.utils";
import { createLogModel, logger, LogModel, logService } from "../utils/logger.utils";
import { LOG_APPS, LOG_MSG } from "../constants/log.constant";
import { Characteristic, IGetProfileDtacRequest, IGetProfileTrueRequest } from "../interfaces/otp.interface";

export class OtpService {

    private readonly config: any

    constructor() {
        this.config = readConfiguration()
    }

    public async requestOtp(phoneNumber: string) {

        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_REQUEST_OTP, logModel);
        let requestOtpPayload

        try {
            const apigeeClientAdapter = new ApigeeClientAdapter
            const transactionId = generateTransactionId()
            const sendTime = moment().format('YYYY-MM-DD[T]HH:mm:ss.SSS');
            const decryptedMobile = await apigeeClientAdapter.apigeeDecrypt(phoneNumber)
            const thailandMobile = convertToThailandMobile(decryptedMobile)

            requestOtpPayload = {
                id: transactionId,
                sendTime: sendTime,
                description: "TH", // * FIX
                channel: "true", // * FIX
                code: "220594", // * PENDING TO CONFIRM
                receiver: [
                    {
                        phoneNumber: thailandMobile,
                        relatedParty: {
                            id: "VC-ECOM" // * CONFIRM ??
                        }
                    }
                ]
            }


            const response = await apigeeClientAdapter.requestOTP(requestOtpPayload)

            const { data } = response

            logService(requestOtpPayload, response, logStepModel)
            const otpNumberMinuteExpire = this.config.otp.expireTime as number
            const otpNumberSecondResend = this.config.otp.resendTime as number
            const expireAt = moment(data.sendCompleteTime).add(otpNumberMinuteExpire, 'minutes').format('YYYY-MM-DDTHH:MM:SS+07:00')
            const refCode = getOTPReferenceCodeFromArray(data.characteristic) ?? "Invalid"

            logger.info(JSON.stringify({ phoneNumber, refCode, date: moment() }))

            return {
                otp: {
                    expireAt,
                    refCode
                },
                config: {
                    otpNumberMinuteExpire,
                    otpNumberSecondResend
                }
            }

        } catch (e: any) {
            logger.info(JSON.stringify({ phoneNumber, refCode: null, date: moment() }))
            logService(requestOtpPayload, e, logModel)
            throw e
        }
    }

    public async verifyOtp(phoneNumber: string, refCode: string, pin: string, journey: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_VERIFY_OTP, logModel);
        let verifyOtpPayload
        const logInformation = {
            otpNumber: "",
            refCode: "",
            journey: "",
            status: "",
            reason: "",
            date_time: moment().toISOString()
        }
        try {

            const apigeeClientAdapter = new ApigeeClientAdapter
            const sendTime = moment().format('YYYY-MM-DD[T]HH:mm:ss.SSS');
            const decryptedMobile = await apigeeClientAdapter.apigeeDecrypt(phoneNumber)

            const thailandMobile = convertToThailandMobile(decryptedMobile)

            verifyOtpPayload = {
                id: refCode,
                sendTime: sendTime,
                description: "TH", // * FIX
                channel: "true", // * FIX
                code: "220594", // * PENDING TO CONFIRM ??
                content: pin,
                receiver: [
                    {
                        phoneNumber: thailandMobile,
                        relatedParty: {
                            id: "VC-ECOM" // * CONFIRM ??
                        }
                    }
                ]
            }

            const isMockOtp = this.config.otp.isMock as boolean

            if (isMockOtp) {
                const otpErrorMap: Record<string, { status: number; statusCode: string; statusMessage: string; errorCode?: string }> = {
                    '100002': {
                        status: 400,
                        statusCode: '400.4003',
                        statusMessage: 'OTP is not match for 5 times',
                        errorCode: 'OTP_IS_NOT_MATCH_FOR_5_TIMES'
                    },
                    '100003': {
                        status: 400,
                        statusCode: '400.4004',
                        statusMessage: 'OTP has expired',
                        errorCode: 'OTP_HAS_EXPIRED'
                    },
                    '100004': {
                        status: 400,
                        statusCode: '400.4005',
                        statusMessage: 'Operator not TRUE or DTAC',
                        errorCode: 'OPERATOR_NOT_TRUE_OR_DTAC'
                    },
                    '100005': {
                        status: 400,
                        statusCode: '400.4016',
                        statusMessage: 'Get operator fail',
                        errorCode: 'GET_OPERATOR_FAIL'
                    },
                    '100006': {
                        status: 400,
                        statusCode: '400.4006',
                        statusMessage: 'Black listed customer is not allowed',
                        errorCode: 'BLACK_LISTED_CUSTOMER_NOT_ALLOWED'
                    },
                    '100007': {
                        status: 400,
                        statusCode: '400.4007',
                        statusMessage: 'Get customer tier fail',
                        errorCode: 'GET_CUSTOMER_TIER_FAIL'
                    },
                    '100008': {
                        status: 400,
                        statusCode: '400.4008',
                        statusMessage: 'Get contract fail',
                        errorCode: 'GET_CONTRACT_FAIL'
                    },
                    '100009': {
                        status: 400,
                        statusCode: '400.4009',
                        statusMessage: 'Get package info fail',
                        errorCode: 'GET_PACKAGE_INFO_FAIL'
                    },
                    '100010': {
                        status: 400,
                        statusCode: '400.4010',
                        statusMessage: 'Get profile info fail',
                        errorCode: 'GET_PROFILE_INFO_FAIL'
                    },
                    '100011': {
                        status: 400,
                        statusCode: '400.4011',
                        statusMessage: 'Subscriber type is not postpaid',
                        errorCode: 'SUBSCRIBER_TYPE_NOT_POSTPAID'
                    },
                    '100012': {
                        status: 400,
                        statusCode: '400.4012',
                        statusMessage: 'Get quota fail',
                        errorCode: 'GET_QUOTA_FAIL'
                    },
                    '100013': {
                        status: 400,
                        statusCode: '400.4013',
                        statusMessage: 'Not allowed to extend contract',
                        errorCode: 'NOT_ALLOWED_TO_EXTEND_CONTRACT'
                    },
                    '100014': {
                        status: 400,
                        statusCode: '400.4014',
                        statusMessage: 'Offer package not found',
                        errorCode: 'OFFER_PACKAGE_NOT_FOUND'
                    },
                    '100015': {
                        status: 400,
                        statusCode: '400.4015',
                        statusMessage: 'Get offer package fail',
                        errorCode: 'GET_OFFER_PACKAGE_FAIL'
                    },
                    '500000': {
                        status: 500,
                        statusCode: '500.9999',
                        statusMessage: 'Unknown error',
                        errorCode: 'UNKNOWN_ERROR'
                    }
                };


            } else {

                const response = await apigeeClientAdapter.verifyOTP(verifyOtpPayload)
                logService(verifyOtpPayload, response, logStepModel)
                const operator = await this.checkOperator(phoneNumber)
                const customerOperatorIsActive = await this.checkActive(operator, journey)

                logInformation.journey = journey
                logInformation.otpNumber = pin
                logInformation.refCode = refCode
                logInformation.status = "Pass"
                logInformation.reason = "Verify OTP successfully"

                logger.info(JSON.stringify(logInformation))

                return {
                    customerOperator: operator,
                    isOperatorIsActive: customerOperatorIsActive
                }
            }

        } catch (e: any) {
            logService(verifyOtpPayload, e, logStepModel)
            logInformation.journey = journey
            logInformation.otpNumber = pin
            logInformation.refCode = refCode
            logInformation.status = "Failed"
            logInformation.reason = e.statusMessage || e.response.data?.message || e.message || "Internal Server Error";

            logger.error(JSON.stringify(logInformation))
            logger.error(`VERIFY_OTP`, e)
            throw e
        }
    }

    private async checkOperator(phoneNumber: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_OPERATOR, logModel);
        let checkOperatorPayload
        const isMockOtp = this.config.otp.isMock as boolean
        const txid = isMockOtp ? '1234567' : Math.floor(100000 + Math.random() * 900000).toString()

        try {
            const apigeeClientAdapter = new ApigeeClientAdapter
            checkOperatorPayload = {
                phoneNumber,
                txid
            }
            const response = await apigeeClientAdapter.checkOperator(phoneNumber, txid)
            logService(checkOperatorPayload, response, logStepModel)
            const result = validateOperator(response.data.operator)

            return result
        } catch (e: any) {
            logService(checkOperatorPayload, e, logStepModel)
            logger.error('Error checkOperator')
            throw e
        }
    }

    private async checkActive(operator: string, journey: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.CT_CHECK_OPERATOR_JOURNEY_ACTIVATION, logModel);
        let checkJourneyActivationPayload
        try {
            checkJourneyActivationPayload = {
                operator,
                journey,
            }
            const response = await CommercetoolsCustomObjectClient.getJourneyActivationByOperator()

            logModel.logSuccess(checkJourneyActivationPayload, response)
            const journeyItem = response.find(journeyActive => journeyActive.journey === journey)

            if (!journeyItem) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Invalid journey',
                    errorCode: 'INVALID_JOURNEY'
                }
            }

            const isActive = getValueByKey(journeyItem?.operators, operator)

            if (!isActive) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Journey not active by operator',
                    errorCode: 'JOURNAL_NOT_ACTIVE_BY_OPERATOR'
                }
            }

            return isActive
        } catch (e: any) {
            logService(checkJourneyActivationPayload, e, logStepModel)
            throw e
        }
    }

    private async getTrueProfile(phoneNumber: string, id: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_GET_PROFILE_AND_PACKAGE, logModel);
        const getProfilePayload: IGetProfileTrueRequest = {
            id,
            channel: "true", // ? FIX
            limit: "50", // ? FIX
            page: "1", // ? FIX
            relatedParty: {
                id: phoneNumber,
                type: "MOBILE"
            },
            characteristic: [
                {
                    name: "agingIndicator",
                    value: "Y"
                }
            ]
        }

        try {
            // TODO :: Block TCB case
            // TODO :: When K'Kor fullfil coda IMPLEMENT THIS
            const apigeeClientAdapter = new ApigeeClientAdapter
            const response = await apigeeClientAdapter.getProfileAndPackage(getProfilePayload)
            logService(getProfilePayload, response, logStepModel)
            const { data, code } = response.data
            if (code === '0') {

                if (data.subscriberInfo.telType !== 'T') {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Subscriber type is not postpaid',
                        errorCode: 'SUBSCRIBER_TYPE_NOT_POST_POSTPAID'
                    }
                }

                const thaiId = data.engagedParty.id
                const aging = data.aging

                return {
                    thaiId,
                    aging
                    // Get current package price plan (RC)
                    // ! TBC about RC Current Price
                }
            } else {
                throw {
                    statusCode: 400,
                    statusMessage: 'Get profile fail',
                    errorCode: 'GET_PROFILE_FAIL'
                }
            }


        } catch (e: any) {
            logService(getProfilePayload, e, logStepModel)
            throw e
        }
    }

    private async getDtacProfile(phoneNumber: string, id: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_GET_PROFILE_AND_PACKAGE, logModel);
        const getProfilePayload: IGetProfileDtacRequest = {
            id,
            channel: "dtac",
            category: "1",
            relatedParty: {
                id: phoneNumber,
            }
        }
        try {
            // TODO :: Block TCB case
            // TODO :: When K'Kor fullfil coda IMPLEMENT THIS
            const apigeeClientAdapter = new ApigeeClientAdapter
            const response = await apigeeClientAdapter.getProfileAndPackage(getProfilePayload)
            logService(getProfilePayload, response, logStepModel)
            const { data, code } = response.data
            if (code === '0') {
                if (data.subscriberInfo.telType !== 'T') {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Subscriber type is not postpaid',
                        errorCode: 'SUBSCRIBER_TYPE_NOT_POST_POSTPAID'
                    }
                }

                const thaiId = data.engagedParty.id
                const custValue = data.relatedParty.href
                const aging: Characteristic = data.characteristic.find((c: Characteristic) => c.name === "CS_CUST__OCCP_CODE")

                return {
                    thaiId,
                    aging: aging.value,
                    custValue
                }
            } else {
                throw {
                    statusCode: 400,
                    statusMessage: 'Get profile fail',
                    errorCode: 'GET_PROFILE_FAIL'
                }
            }


        } catch (e: any) {
            logService(getProfilePayload, e, logStepModel)
            throw e
        }
    }

    private async checkBacklist(id: string, cardId: string, company: string, custValue?: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_BACKLIST, logModel);
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter

            if (company === 'true') {
                const response = await apigeeClientAdapter.checkBacklistTrue(id, cardId)
                logService({ id, cardId, company }, response, logStepModel)
                const { data } = response.data

                if (data.mobileRelaxBlacklist === 'Y') {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Black Listed Customer is not allowed',
                        errorCode: 'BLACK_LISTED_CUSTOMER_IS_NOT_ALLOWED'
                    }
                }
            }

            if (company === 'dtac') {
                if (!custValue) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Customer value is required',
                        errorCode: 'CUSTOMER_VALUE_REQUIRED'
                    }
                }

                const response = await apigeeClientAdapter.checkBacklistDtac(id, cardId, custValue)
                logService({ id, cardId, company }, response, logStepModel)
                const { status } = response.data

                if (status === "FALSE") {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Black Listed Customer is not allowed',
                        errorCode: 'BLACK_LISTED_CUSTOMER_IS_NOT_ALLOWED'
                    }
                }
            }


        } catch (e: any) {
            logService({ id, cardId, company, custValue }, e, logStepModel)
            throw e
        }
    }

    private async checkContractAndQuota(id: string, agreementId: string, company: string, thaiId?: string,) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_BACKLIST, logModel);
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter

            if (company === 'true') {
                const response = await apigeeClientAdapter.getContractAndQuotaTrue(id, agreementId)
                logService({ id, agreementId }, response, logStepModel)
                const { data } = response.data

                if (data.mobileRelaxBlacklist === 'Y') {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Black Listed Customer is not allowed',
                        errorCode: 'BLACK_LISTED_CUSTOMER_IS_NOT_ALLOWED'
                    }
                }
            }

            if (company === 'dtac') {
                if (!thaiId) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Thai ID not found',
                        errorCode: 'THAI_ID_NOT_FOUND'
                    }
                }

                const response = await apigeeClientAdapter.getContractAndQuotaDtac(id, thaiId)
                logService({ id, company, thaiId }, response, logStepModel)
                const { status } = response.data

                if (status === "FALSE") {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Black Listed Customer is not allowed',
                        errorCode: 'BLACK_LISTED_CUSTOMER_IS_NOT_ALLOWED'
                    }
                }
            }


        } catch (e: any) {
            logService({ id, company, thaiId }, e, logStepModel)
            throw e
        }
    }

    private async getCustomerTier(id: string, mobileNumber: string, operator: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_GET_CUSTOMER_TIER, logModel);
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter

            if (!id) {
                throw {
                    statusCode: 400,
                    statusMessage: 'id is required',
                    errorCode: 'ID_IS_REQUIRED'
                }
            }

            if (!mobileNumber) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Mobile Number is required',
                    errorCode: 'MOBILE_NUMBER_IS_REQUIRED'
                }
            }

            if (!operator) {
                throw {
                    statusCode: 400,
                    statusMessage: 'Operator is required',
                    errorCode: 'OPERATOR_IS_REQUIRED'
                }
            }

            // if (operator === 'true') {
            //     const response = await apigeeClientAdapter.getCustomerTierTrue(mobileNumber)
            //     logService({ mobileNumber }, response, logStepModel)
            //     const { data } = response.data

            // }

            // if (operator === 'dtac') {

            const mobileDecrypt = await apigeeClientAdapter.apigeeDecrypt(mobileNumber)

            console.log({ mobileDecrypt })


            const response = await apigeeClientAdapter.getCustomerTierDtac(id, mobileDecrypt)
            logService({ id, mobileDecrypt, operator }, response, logStepModel)
            const res = response.data

            console.log({ res })


            // }




        } catch (e: any) {
            logService({ id, operator, mobileNumber }, e, logStepModel)
            throw e
        }
    }

}
