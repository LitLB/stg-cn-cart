// src/services/otp.service.ts

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone"; // Required for specific timezone formatting


import ApigeeClientAdapter, { apigeeClientAdapter } from "../adapters/apigee-client.adapter";
import { hlClientAdapter } from '../adapters/headless-client.adapter'
import { readConfiguration } from "../utils/config.utils";
import { getOTPReferenceCodeFromArray } from "../utils/array.utils";
import { generateTransactionId } from "../utils/date.utils";
import { convertToThailandMobile, safeStringify } from "../utils/formatter.utils"; // Added safeStringify
import { validateOperator } from "../utils/operator.utils";
import CommercetoolsCustomObjectClient from "../adapters/ct-custom-object-client"
import { getValueByKey } from "../utils/object.utils";
import { createLogModel, logger, LogModel, logService } from "../utils/logger.utils";
import { LOG_APPS, LOG_MSG } from "../constants/log.constant";
import { OPERATOR } from "../constants/operator.constant";
import { validateContractAndQuotaDtac, validateContractAndQuotaTrue, validateCustomerDtacProfile, validateCustomerTrueProfile, validateSharePlan } from "../validators/operator.validators";
import { encryptedOFB } from "../utils/apigeeEncrypt.utils";
import { CustomerVerificationData, CustomerVerifyQueryParams } from "../interfaces/verify.interface";
import { ICheckCustomerProfileResponse } from "../interfaces/validate-response.interface";
import { CART_JOURNEYS } from "../constants/cart.constant";
import { STATUS_CODES } from "http";
import { EXCEPTION_MESSAGES } from "../constants/messages.constant";
import { CUSTOMER_VERIFY_STATES } from "../constants/ct.constant";
import { VerifyDopaPOPStatusRequestBody } from "../interfaces/dopa.interface";
import { VERIFY_DOPA_POP_STATUS_CHANNEL } from "../constants/verify.constant";
import { omniService } from "./omni.service";

dayjs.extend(utc);
dayjs.extend(timezone); // Extend dayjs with timezone plugin

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

    public async verifyOtp(phoneNumber: string, refCode: string, pin: string, journey: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_VERIFY_OTP, logModel);
        const apigeeClientAdapter = new ApigeeClientAdapter
        const decryptedMobile = await apigeeClientAdapter.apigeeDecrypt(phoneNumber)
        const isMockOtp = this.config.otp.isMock as string
        const thailandMobile = convertToThailandMobile(decryptedMobile)

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
                    },
                    '100004': {
                        status: 400,
                        statusCode: '400.4028',
                        statusMessage: 'Verify OTP Fail',
                        errorCode: 'VERIFY_OTP_FAIL'
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

            logger.error(JSON.stringify(logInformation));

            throw e
        }
    }

    private async checkOperator(id: string, phoneNumber: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_OPERATOR, logModel);
        let checkOperatorPayload

        const txid = id.substring(id.length - 7)

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
            throw e
        }
    }

    private async checkActive(journey: string, operator: string) {
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
                    statusCode: "400.1001",
                    statusMessage: 'Input parameter is blank or invalid',
                }
            }

            const isActive = getValueByKey(journeyItem?.operators, operator)

            if (!isActive) {
                throw {
                    statusCode: "400.4018",
                    statusMessage: "Company is not allow",
                }
            }

            return isActive
        } catch (e: any) {
            logService(checkJourneyActivationPayload, e, logStepModel)
            throw e
        }
    }

    public async getCustomerProfile(id: string, journey: string, verifyStates: string[], mobileNumber: string) {
        let operator: typeof OPERATOR[keyof typeof OPERATOR] = 'unknown';

        // Step 2: Check operator
        if (verifyStates.includes('operator')) {
            operator = await this.checkOperator(id, mobileNumber);
        }

        const [_, response] = await Promise.all([
            // Step 2: Check operator (verify company)
            verifyStates.includes('operator')
                ? this.checkActive(journey, operator)
                : Promise.resolve(),

            // Step 3: Check profile & package
            verifyStates.includes('profileAndPackage')
                ? this.getProfileAndPackage(id, operator, mobileNumber)
                : Promise.resolve(),

            // Step 4: Check share plan for DTAC only
            verifyStates.includes('sharePlan')
                ? this.checkSharePlan(operator, mobileNumber)
                : Promise.resolve()
        ]);

        let customerProfile

        // Step 3: Check profile & package
        if (verifyStates.includes('profileAndPackage')) {
            if (operator === OPERATOR.TRUE) {
                customerProfile = validateCustomerTrueProfile(response.data);
            }
            if (operator === OPERATOR.DTAC) {
                customerProfile = validateCustomerDtacProfile(response.data);
            }
        }

        // Run post-checks concurrently.
        await Promise.all([
            // Step 5: Check blacklist
            verifyStates.includes('blacklist')
                ? this.checkBacklist(id, operator, customerProfile?.thaiId, customerProfile?.customerNo)
                : Promise.resolve(),

            // Step 6: Check contract & quota (DTAC only)
            verifyStates.includes('contractAndQuota')
                ? this.checkContractAndQuota(id, operator, customerProfile?.thaiId, customerProfile?.agreementId)
                : Promise.resolve(),
        ]);

        return customerProfile;
    }

    private async checkSharePlan(operator: string, mobileNumber: string) {
        if (operator !== OPERATOR.DTAC) return;

        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_SHARE_PLAN, logModel);
        const apigeeClientAdapter = new ApigeeClientAdapter();
        const decryptMobile = await apigeeClientAdapter.apigeeDecrypt(mobileNumber)
        const thMobile = convertToThailandMobile(decryptMobile)
        const encryptMobile = await apigeeClientAdapter.apigeeEncrypt(thMobile)

        try {
            const response = await apigeeClientAdapter.checkSharePlanDtac(encryptMobile)
            logService(mobileNumber, response, logStepModel);
            validateSharePlan(response.data)

        } catch (e) {
            logService(mobileNumber, e, logStepModel);
            throw e
        }
    }

    private async getProfileAndPackage(id: string, operator: string, mobileNumber: string) {
        if (operator !== OPERATOR.TRUE && operator !== OPERATOR.DTAC) return;

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

    private async checkBacklist(id: string, operator: string, thaiId?: string, custValue?: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_BACKLIST, logModel);

        try {
            const apigeeClientAdapter = new ApigeeClientAdapter

            if (operator === OPERATOR.TRUE) {
                if (!thaiId) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Thai ID value is required',
                        errorCode: 'THAI_ID_VALUE_REQUIRED'
                    }
                }

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
                if (!thaiId) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Thai ID value is required',
                        errorCode: 'THAI_ID_VALUE_REQUIRED'
                    }
                }

                if (!custValue) {
                    throw {
                        statusCode: 400,
                        statusMessage: 'Customer value is required',
                        errorCode: 'CUSTOMER_VALUE_REQUIRED'
                    }
                }

                const decryptedThaiId = await apigeeClientAdapter.apigeeDecrypt(thaiId)
                const response = await apigeeClientAdapter.checkBacklistDtac(id, decryptedThaiId, custValue)

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
                const decryptedThaiId = await apigeeClientAdapter.apigeeDecrypt(thaiId)

                const newThaiId = encryptedOFB(decryptedThaiId, key)

                const response = await apigeeClientAdapter.getContractAndQuotaDtac(id, newThaiId)
                logService({ id, operator, thaiId }, response.data, logStepModel)
                const data = response.data

                validateContractAndQuotaDtac(data)
            }

        } catch (e: any) {
            logService({ id, operator, thaiId }, e, logStepModel)

            if (operator === OPERATOR.TRUE && e.status === 400) {

                if (e.response?.data?.code === "400.209.0020") {
                    return
                }

                throw {
                    statusCode: '400.4008',
                    statusMessage: 'Get contract fail',
                }
            }
            throw e
        }
    }

    public async getCustomerTier(id: string, mobileNumber: string, journey: string) {


        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_GET_CUSTOMER_TIER, logModel);
        const apigeeClientAdapter = new ApigeeClientAdapter
        const operator = await this.checkOperator(id, mobileNumber)
        try {

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


            if (operator === OPERATOR.TRUE) {
                const response = await apigeeClientAdapter.getCustomerTierTrue(mobileNumber)
                logService({ mobileNumber }, response, logStepModel)
                const { data } = response.data

                return {
                    customerTierCode: data.accountGrade.type,
                    customerTierName: data.trueCart.type
                }

            }

            if (operator === OPERATOR.DTAC) {

                const mobileDecrypt = await apigeeClientAdapter.apigeeDecrypt(mobileNumber)
                const thMobile = convertToThailandMobile(mobileDecrypt)

                const response = await apigeeClientAdapter.getCustomerTierDtac(id, thMobile)
                logService({ id, mobileDecrypt, operator }, response, logStepModel)
                const { data } = response.data


                const tierName: Record<string, string> = {
                    '1000': 'Platinum Blue',
                    '2000': 'Gold',
                    '3000': 'Silver',
                    '4000': 'Welcome',
                };

                return {
                    customerTierCode: data.segmentCode,
                    customerTierName: tierName[data.segmentCode]
                }

            }


        } catch (e: any) {
            logService({ id, operator, mobileNumber }, e, logStepModel)
            throw e
        }
    }

    private async performVerifyDopaStatus(
        correlatorid: string,
        decryptedCertificationId: string,
        decryptedDateOfBirth: string,
        decryptedMobileNumber?: string
    ): Promise<CustomerVerificationData> {
        const verifyDopaPOPStatusRequestBody: VerifyDopaPOPStatusRequestBody = {
            verifyDopaPOPstatus: {
                requestId: correlatorid,
                channel: VERIFY_DOPA_POP_STATUS_CHANNEL.CRM,
                idNumber: decryptedCertificationId,
                dateOfBirth: decryptedDateOfBirth,
                timeStamp: new Date(),
            },
        };

        if (decryptedMobileNumber) {
            verifyDopaPOPStatusRequestBody.verifyDopaPOPstatus.MSSIDN = decryptedMobileNumber;
        }

        const response: CustomerVerificationData = {
            verifyResult: {
                verifyDopaStatus: 'skip',
            }
        }

        try {
            const verifyDopaPOPStatusResponse = await omniService.verifyDopaPOPStatus(verifyDopaPOPStatusRequestBody);
            const { resultCode, resultInfo } = verifyDopaPOPStatusResponse?.resultResponse || {};
            const { code, flagBypass } = resultInfo || {};

            if (resultCode === '200' && code === '00') {
                if (flagBypass === 'N') {
                    response.verifyResult.verifyDopaStatus = 'success';
                } else {
                    response.verifyResult.verifyDopaStatus = 'bypass';
                }
            } else if (resultCode && resultCode !== '200') {
                response.verifyResult.verifyDopaStatus = 'fail';
            }

            return response;
        } catch (error) {
            return response;
        }
    }

    private performHLPreVerify(certificationId: string): CustomerVerificationData {
        const result = hlClientAdapter.preVerify(certificationId) as unknown as CustomerVerificationData

        if ((result as unknown as Record<string, unknown>)['statusCode']) {
            throw {
                status: 400,
                statusCode: (result as unknown as Record<string, unknown>)['statusCode'],
                statusMessage: (result as unknown as Record<string, unknown>)['statusMessage']
            }
        }

        return result
    }

    private async _handleVerificationByState(
        verifyState: string | undefined,
        correlatorid: string,
        decryptedCertificationId: string,
        decryptedDateOfBirth: string,
        decryptedMobileNumber?: string
    ): Promise<CustomerVerificationData> {
        switch (verifyState) {
            case CUSTOMER_VERIFY_STATES.dopa:
                return this.performVerifyDopaStatus(
                    correlatorid,
                    decryptedCertificationId,
                    decryptedDateOfBirth,
                    decryptedMobileNumber
                );
            case CUSTOMER_VERIFY_STATES.hlPreverFull:
                return this.performHLPreVerify(decryptedCertificationId)
            case CUSTOMER_VERIFY_STATES.hl4DScore:
                throw new Error(`This verifyState = ${verifyState} is unsupported`);
            default:
                throw new Error(`This verifyState = ${String(verifyState)} is unsupported`);
        }
    }

    // Parent
    public async handleCustomerVerification(
        correlatorid: string,
        queryParams: CustomerVerifyQueryParams
    ): Promise<ICheckCustomerProfileResponse | CustomerVerificationData> {
        try {
            const {
                journey,
                certificationId,
                dateOfBirth,
                mobileNumber,
                // certificationType, // string - for headless
                // campaignCode,      // string - for headless
                // productCode,       // string - for headless
                // propoId            // string - for headless
                verifyState,
            } = queryParams;

            if (journey === CART_JOURNEYS.DEVICE_ONLY || journey === CART_JOURNEYS.DEVICE_BUNDLE_EXISTING) {
                const mobileNumberStr = queryParams.mobileNumber as string;
                const verifyStateArr: Array<string> = [verifyState].flat();
                const customerProfile = await this.getCustomerProfile(correlatorid, journey, verifyStateArr, mobileNumberStr) as ICheckCustomerProfileResponse;
                return customerProfile;
            } else {
                const verifyStateString = verifyState?.[0];
                let decryptedMobileNumber;
                const decryptedCertificationId = await apigeeClientAdapter.apigeeDecrypt(certificationId);
                const decryptedDateOfBirth = await apigeeClientAdapter.apigeeDecrypt(dateOfBirth);
                if (mobileNumber) {
                    decryptedMobileNumber = await apigeeClientAdapter.apigeeDecrypt(mobileNumber);
                }

                return this._handleVerificationByState(
                    verifyStateString,
                    correlatorid,
                    decryptedCertificationId,
                    decryptedDateOfBirth,
                    decryptedMobileNumber
                );
            }
        } catch (error: any) {
            if (error.statusCode) {
                throw error;
            }
            logger.error(`OtpService.handleCustomerVerification.error`, error);

            throw {
                statusCode: STATUS_CODES.DESTINATION_ERROR_500,
                statusMessage: EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR,
            }
        }
    }
}
