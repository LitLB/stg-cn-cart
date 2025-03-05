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
import { IGetProfileDtacRequest, IGetProfileTrueRequest } from "../interfaces/otp.interface";
import { OPERATOR } from "../constants/operator.constant";
import { validateCustomerDtacProfile, validateCustomerTrueProfile } from "../validators/operator.validators";
import { ICheckCustomerProfileResponse } from "../interfaces/validate-response.interface";

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
                description: "TH",
                channel: "true",
                code: "230187",
                receiver: [
                    {
                        phoneNumber: thailandMobile,
                        relatedParty: {
                            id: "ECP"
                        }
                    }
                ]
            }


            const response = await apigeeClientAdapter.requestOTP(requestOtpPayload)

            const { data } = response

            logService(requestOtpPayload, response, logStepModel)

            const otpNumberMinuteExpire = this.config.otp.expireTime as number
            const otpNumberSecondResend = this.config.otp.resendTime as number

            const expireAt = moment(data.sendCompleteTime).add(otpNumberMinuteExpire, 'minute')
            expireAt.add('7', 'hours')
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
            const decryptedMobile = await apigeeClientAdapter.apigeeDecrypt(phoneNumber)

            const thailandMobile = convertToThailandMobile(decryptedMobile)

            verifyOtpPayload = {
                id: refCode,
                description: "TH",
                channel: "true",
                code: "230187",
                content: pin,
                receiver: [
                    {
                        phoneNumber: thailandMobile,
                        relatedParty: {
                            id: "ECP"
                        }
                    }
                ]
            }

            const isMockOtp = this.config.otp.isMock as string

            if (isMockOtp === 'true') {

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

                if (pin === '888888') {
                    // ? INFO :: This is mock response from the server APIGEE
                    const response = {
                        status: 200,
                        data: {
                            packageList: [
                                {
                                    packageInfo: {
                                        packageId: "4fa2c291-1fce-4389-a171-0369a33addb0",
                                        packageName: "5G Together Device 1199_Voice 250min_Net Unltd",
                                        priceplanRc: "899",
                                        contractTerm: "12",
                                        netInfo: "net 40 GB unlimited 100 Mbps",
                                        voiceInfo: [
                                            "call Unlimit True networks",
                                            "call 400 mins all networks"
                                        ],
                                        wifiInfo: "wifi Unlimit @TRUE-WIFI",
                                        additionalPackage: [
                                            "รับชม ฟุตบอลพรีเมียร์ลีก ตลอดฤดูกาล 2023/24"
                                        ]
                                    },
                                    campaignInfo: {
                                        campaignName: "เฉพาะลูกค้า True Black Card",
                                        customerTier: "BLACK",
                                        price: "13599",
                                        advanceService: "2000",
                                        seq: 1
                                    }
                                },
                                {
                                    packageInfo: {
                                        packageId: "4fa2c291-1fce-4389-a171-0369a33addb0",
                                        packageName: "5G Together Device 1199_Voice 250min_Net Unltd",
                                        priceplanRc: "899",
                                        contractTerm: "12",
                                        netInfo: "net 40 GB unlimited 100 Mbps",
                                        voiceInfo: [
                                            "call Unlimit True networks",
                                            "call 400 mins all networks"
                                        ],
                                        wifiInfo: "wifi Unlimit @TRUE-WIFI",
                                        additionalPackage: [
                                            "รับชม ฟุตบอลพรีเมียร์ลีก ตลอดฤดูกาล 2023/24"
                                        ]
                                    },
                                    campaignInfo: {
                                        campaignName: "เฉพาะลูกค้า True Red Card",
                                        customerTier: "RED",
                                        price: "15599",
                                        advanceService: "3000",
                                        seq: 2
                                    }
                                }
                            ]
                        }
                    }

                    logService(verifyOtpPayload, response, logStepModel)

                    logInformation.journey = journey
                    logInformation.otpNumber = pin
                    logInformation.refCode = refCode
                    logInformation.status = "Pass"
                    logInformation.reason = "Verify OTP successfully"

                    logger.info(JSON.stringify(logInformation))

                } else if (otpErrorMap[pin]) {
                    logService(verifyOtpPayload, otpErrorMap[pin], logStepModel)
                    throw otpErrorMap[pin]

                } else {
                    throw {
                        status: 400,
                        statusCode: '400.4002',
                        statusMessage: 'OTP is not match',
                        errorCode: 'OTP_IS_NOT_MATCH'
                    }
                }

            } else {
                const response = await apigeeClientAdapter.verifyOTP(verifyOtpPayload)
                logService(verifyOtpPayload, response, logStepModel)

                logInformation.journey = journey
                logInformation.otpNumber = pin
                logInformation.refCode = refCode
                logInformation.status = "Pass"
                logInformation.reason = "Verify OTP successfully"
                logger.info(JSON.stringify(logInformation))

                return
            }

        } catch (e: any) {
            logService(verifyOtpPayload, e, logStepModel)
            logInformation.journey = journey
            logInformation.otpNumber = pin
            logInformation.refCode = refCode
            logInformation.status = "Failed"
            logInformation.reason = e.response?.data.message || e.errorCode || e.statusMessage || e.message || "Internal Server Error";
            logger.error(JSON.stringify(logInformation))

            throw e
        }
    }

    private async checkOperator(phoneNumber: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_OPERATOR, logModel);
        let checkOperatorPayload
        const isMockOtp = this.config.otp.isMock as string
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

    public async getCustomerProfile(id: string, mobileNumber: string, operator: string, journey: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_GET_PROFILE_AND_PACKAGE, logModel);

        let getProfilePayload: Partial<IGetProfileDtacRequest | IGetProfileTrueRequest> = {}

        const basePayload = {
            id,
            channel: operator,
        };

        if (operator === OPERATOR.TRUE) {
            getProfilePayload = {
                ...basePayload,
                limit: "50",
                page: "1",
                relatedParty: {
                    id: mobileNumber,
                    type: "MOBILE"
                },
                characteristic: [
                    {
                        name: "agingIndicator",
                        value: "Y"
                    }
                ]
            };

        } else {
            getProfilePayload = {
                ...basePayload,
                category: "2",
                relatedParty: {
                    id: mobileNumber
                }
            };
        }

        try {
            const apigeeClientAdapter = new ApigeeClientAdapter

            const response = await apigeeClientAdapter.getProfileAndPackage(getProfilePayload)

            logService(getProfilePayload, response, logStepModel)
            const { data, code } = response.data

            let customerProfile: ICheckCustomerProfileResponse

            if (code === '0') {

                customerProfile = operator === OPERATOR.TRUE ? validateCustomerTrueProfile(data) : validateCustomerDtacProfile(data)

            } else {
                throw {
                    statusCode: 400,
                    statusMessage: 'Get profile fail',
                    errorCode: 'GET_PROFILE_FAIL'
                }
            }

            await this.checkBacklist(id, customerProfile.thaiId, operator, customerProfile.customerNo);

            return customerProfile

        } catch (e: any) {
            logService(getProfilePayload, e, logStepModel)
            throw e
        }
    }

    private async checkBacklist(id: string, thaiId: string, operator: string, custValue?: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_BACKLIST, logModel);

        try {
            const apigeeClientAdapter = new ApigeeClientAdapter

            if (operator === OPERATOR.TRUE) {
                const response = await apigeeClientAdapter.checkBacklistTrue(id, thaiId)
                logService({ id, thaiId, operator }, response, logStepModel)
                const { data } = response.data

                if (data.mobileRelaxBlacklist === 'Y') {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Black Listed Customer is not allowed',
                        errorCode: 'BLACK_LISTED_CUSTOMER_IS_NOT_ALLOWED'
                    }
                }
            }

            if (operator === OPERATOR.DTAC) {
                if (!custValue) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Customer value is required',
                        errorCode: 'CUSTOMER_VALUE_REQUIRED'
                    }
                }

                const response = await apigeeClientAdapter.checkBacklistDtac(id, thaiId, custValue)

                logService({ id, thaiId, operator }, response, logStepModel)
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
            logService({ id, thaiId, operator, custValue }, e, logStepModel)
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

}
