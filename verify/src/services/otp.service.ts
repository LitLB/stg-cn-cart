import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";


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
import { OPERATOR } from "../constants/operator.constant";
import { validateContractAndQuotaDtac, validateContractAndQuotaTrue, validateCustomerDtacProfile, validateCustomerTrueProfile, validateSharePlan } from "../validators/operator.validators";
import { encryptedOFB } from "../utils/apigeeEncrypt.utils";
import { transformError } from "../middleware/error-handler.middleware";
import { RedisAdapter } from "../adapters/redis.adapter";

dayjs.extend(utc);

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
            const sendTime = dayjs().format('YYYY-MM-DD[T]HH:mm:ss.SSS');
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

            const expireAt = dayjs().utc().add(otpNumberMinuteExpire, 'minutes').toISOString()

            const refCode = getOTPReferenceCodeFromArray(data.characteristic) ?? "Invalid"

            logger.info(JSON.stringify({ phoneNumber, refCode, date: dayjs() }))

            return {
                otp: {
                    expTime: expireAt,
                    refCode
                },
                config: {
                    otpNumberMinuteExpire,
                    otpNumberSecondResend
                }
            }

        } catch (e: any) {
            logger.info(JSON.stringify({ phoneNumber, refCode: null, date: dayjs() }))
            throw e
        }
    }

    public async verifyOtp(phoneNumber: string, refCode: string, pin: string, journey: string, sourceSystemId: string, correlatorId: string, sessionId: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_VERIFY_OTP, logModel);
        const redisAdapter = new RedisAdapter()
        const apigeeClientAdapter = new ApigeeClientAdapter
        const decryptedMobile = await apigeeClientAdapter.apigeeDecrypt(phoneNumber)
        const isMockOtp = this.config.otp.isMock as string
        const now = dayjs();
        const formatted = now.format('YYYY-MM-DD HH:mm:ss.SSS');
        const thailandMobile = convertToThailandMobile(decryptedMobile)
        const mobileForRedis = '0' + thailandMobile.substring(2);


        let verifyOtpPayload
        const logInformation = {
            otpNumber: "",
            refCode: "",
            journey: "",
            status: "",
            reason: "",
            date_time: dayjs().toISOString()
        }

        try {

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
                    const redisKey = `${sourceSystemId}:customer:verify:guest:${journey}:mobile:${correlatorId}`
                    const redisValue = {
                        sessionId,
                        verifyValue: mobileForRedis,
                        verifyOtpStatus: "success",
                        verifyCustStatus: "pending",
                        createAt: formatted,
                        updateAt: formatted,
                    }

                    isMockOtp ? console.log("redis save success", { redisKey, redisValue }) : await redisAdapter.set(redisKey, JSON.stringify(redisValue), 86400)
                    logger.info(JSON.stringify(logInformation))

                } else if (otpErrorMap[pin]) {
                    logService(verifyOtpPayload, otpErrorMap[pin], logStepModel)

                    const redisKey = `${sourceSystemId}:customer:verify:guest:${journey}:mobile:${correlatorId}`
                    const redisValue = {
                        sessionId,
                        verifyValue: thailandMobile,
                        verifyOtpStatus: "fail",
                        verifyCustStatus: "pending",
                        createAt: formatted,
                        updateAt: formatted,
                    }

                    console.log("redis save success", { redisKey, redisValue })

                    await redisAdapter.set(redisKey, JSON.stringify(redisValue), 86400)

                    logger.info(JSON.stringify(logInformation))

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

                const redisKey = `${sourceSystemId}:customer:verify:guest:${journey}:mobile:${correlatorId}`
                const redisValue = {
                    sessionId,
                    verifyValue: mobileForRedis,
                    verifyOtpStatus: "fail",
                    verifyCustStatus: "pending",
                    createAt: formatted,
                    updateAt: formatted,
                }

                isMockOtp ? console.log("redis save success", { redisKey, redisValue }) : await redisAdapter.set(redisKey, JSON.stringify(redisValue), 86400)

                logger.info(JSON.stringify(logInformation))


            }

        } catch (e: any) {
            logService(verifyOtpPayload, e, logStepModel)
            Object.assign(logInformation, {
                journey,
                otpNumber: pin,
                refCode,
                status: "Failed",
                reason: e.response?.data.message || e.errorCode || e.statusMessage || e.message || "Internal Server Error"
            });

            const redisKey = `${sourceSystemId}:customer:verify:guest:${journey}:mobile:${correlatorId}`
            const redisValue = {
                sessionId,
                verifyValue: mobileForRedis,
                verifyOtpStatus: "fail",
                verifyCustStatus: "pending",
                createAt: formatted,
                updateAt: formatted,
            }

            await redisAdapter.set(redisKey, JSON.stringify(redisValue), 86400)


            logger.error(JSON.stringify(logInformation));

            throw transformError(e)
        }
    }

    private async checkOperator(id: string, phoneNumber: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_OPERATOR, logModel);
        let checkOperatorPayload

        const isMockOtp = this.config.otp.isMock as string
        const txid = isMockOtp === 'true' ? "1234567" : id


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

    public async getCustomerProfile(id: string, mobileNumber: string, journey: string) {
        const operator = await this.checkOperator(id, mobileNumber);
        const [_, response] = await Promise.all([
            // * Check operator active
            this.checkActive(operator, journey),
            // * Get Profile & Package
            this.getProfileAndPackage(id, operator, mobileNumber),
            this.checkSharePlan(operator, mobileNumber)
        ]);

        const customerProfile = operator === OPERATOR.TRUE
            ? validateCustomerTrueProfile(response.data)
            : validateCustomerDtacProfile(response.data);

        // Run post-checks concurrently.
        await Promise.all([
            // * Check backlist
            this.checkBacklist(id, customerProfile.thaiId, operator, customerProfile.customerNo),
            // * Check Contract & Quota
            this.checkContractAndQuota(id, operator, customerProfile.thaiId, customerProfile.agreementId)
        ]);

        return customerProfile;
    }

    private async checkSharePlan(operator: string, mobileNumber: string) {

        if (operator === OPERATOR.TRUE) return

        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_SHARE_PLAN, logModel);
        const apigeeClientAdapter = new ApigeeClientAdapter();

        try {

            const response = await apigeeClientAdapter.checkSharePlanDtac(mobileNumber)
            logService(mobileNumber, response, logStepModel);

            validateSharePlan(response.data)

        } catch (e) {
            logService(mobileNumber, e, logStepModel);
            throw {
                statusCode: "400.4035",
                statusMessage: 'Get customer type fail',
            };
        }
    }

    private async getProfileAndPackage(id: string, operator: string, mobileNumber: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_GET_PROFILE_AND_PACKAGE, logModel);
        const apigeeClientAdapter = new ApigeeClientAdapter();


        const basePayload = { id, channel: operator };
        const getProfilePayload = operator === OPERATOR.TRUE
            ? {
                ...basePayload,
                limit: "50",
                page: "1",
                relatedParty: { id: mobileNumber, type: "MOBILE" },
                characteristic: [{ name: "agingIndicator", value: "Y" }]
            }
            : {
                ...basePayload,
                category: "2",
                relatedParty: { id: mobileNumber }
            };

        try {

            const response = await apigeeClientAdapter.getProfileAndPackage(getProfilePayload)
            logService(getProfilePayload, response, logStepModel);


            return response.data
        } catch (e) {
            logService(getProfilePayload, e, logStepModel);
            throw {
                statusCode: "400.4010",
                statusMessage: 'Get profile info fail',
                errorCode: 'GET_PROFILE_INFO_FAIL'
            };
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
                        statusCode: '400.4006',
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

                if (status !== "FALSE") {
                    throw {
                        statusCode: '400.4006',
                        statusMessage: 'Black Listed Customer is not allowed',
                        errorCode: 'BLACK_LISTED_CUSTOMER_IS_NOT_ALLOWED'
                    }
                }
            }

        } catch (e: any) {
            logService({ id, thaiId, operator, custValue }, e, logStepModel)
            if (operator === OPERATOR.TRUE && e.status === 400) {
                throw {
                    statusCode: '400.4006',
                    statusMessage: 'Black Listed Customer is not allowed',
                    errorCode: 'BLACK_LISTED_CUSTOMER_IS_NOT_ALLOWED'
                }
            }
            throw e
        }
    }

    private async checkContractAndQuota(id: string, operator: string, thaiId?: string, agreementId?: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_CONTRACT_AND_QUOTA, logModel);
        const key = this.config.apigee.privateKeyEncryption;
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter


            if (operator === OPERATOR.TRUE) {

                if (!agreementId || agreementId === undefined) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Agreement ID not found',
                        errorCode: 'AGREEMENT_ID_NOT_FOUND'
                    }
                }

                const response = await apigeeClientAdapter.getContractAndQuotaTrue(id, agreementId)
                logService({ id, agreementId }, response, logStepModel)
                const { agreementItem } = response.data

                validateContractAndQuotaTrue(agreementItem)
            }

            if (operator === OPERATOR.DTAC) {
                if (!thaiId) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Thai ID not found',
                        errorCode: 'THAI_ID_NOT_FOUND'
                    }
                }

                const newThaiId = encryptedOFB(thaiId, key)
                const response = await apigeeClientAdapter.getContractAndQuotaDtac(id, newThaiId)
                logService({ id, operator, thaiId }, response.data, logStepModel)
                const data = response.data

                validateContractAndQuotaDtac(data)
            }

        } catch (e: any) {
            logService({ id, operator, thaiId }, e, logStepModel)

            if (operator === OPERATOR.TRUE && e.status === 400) {

                throw {
                    statusCode: '400.4013',
                    statusMessage: 'Not allowed to extend contract',
                    errorCode: 'NOT_ALLOWED_TO_EXTERNAL_CONTRACT'
                }
            }
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
