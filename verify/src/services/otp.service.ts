// src/services/otp.service.ts

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone"; // Required for specific timezone formatting


import ApigeeClientAdapter from "../adapters/apigee-client.adapter";
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
import { CART_JOURNEYS } from "../constants/cart.constant";
import { ICheckCustomerProfileResponse } from "../interfaces/validate-response.interface";
import { PerformDopaPopStatusVerificationParams, VerifyDopaInternalResult, VerifyDopaPOPStatusApiRequest } from "../interfaces/dopa.interface";
import { CustomerVerifyQueryParams, INewDeviceBundleVerifyResult } from "../interfaces/verify.interface";
import { AxiosError } from "axios";

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

    // TODO: Parent
    // TODO: How to get?
    public async handleCustomerVerification(
        correlatorid: string,
        queryParams: CustomerVerifyQueryParams
    ): Promise<ICheckCustomerProfileResponse | { verifyResult: INewDeviceBundleVerifyResult }> {
        const {
            journey,        // string
            mobileNumber,   // string (Encrypted)
            verifyState,    // string or string[]
            certificationId, // string (Encrypted) - for new_device_bundle
            dateOfBirth,    // string (Encrypted, DDMMYYYY) - for new_device_bundle
            // certificationType, // string - for headless
            // campaignCode,      // string - for headless
            // productCode,       // string - for headless
            // propoId            // string - for headless
        } = queryParams;

        if (journey === CART_JOURNEYS.DEVICE_BUNDLE_EXISTING) {
            return await this.getCustomerProfile(correlatorid, mobileNumber, journey);
        } else {
            const verifyResult: INewDeviceBundleVerifyResult = {
                verifyDopaStatus: 'pending',
                verifyLock3StepStatus: 'skip', // Default to skip unless headless is called
                verify45DayNonShopStatus: 'skip',
                verifyThaiId5NumberStatus: 'skip',
                verifyMaxAllowStatus: 'skip',
                verifyCheckCrossStatus: 'skip',
                verify4DScoreStatus: 'skip',
                verify4DScoreValue: null,
                totalProductTrue: null,
            };

            const apigeeClient = new ApigeeClientAdapter();
            let decryptedCertificationId: string | undefined;
            let decryptedDateOfBirth: string | undefined;
            let decryptedMobileNumber: string | undefined;

            // Attempt to decrypt inputs needed for DOPA or Headless
            // Errors during decryption will be caught and will lead to 'fail' statuses or throw
            try {
                if (certificationId && typeof certificationId === 'string') {
                    decryptedCertificationId = await apigeeClient.apigeeDecrypt(certificationId);
                }
                if (dateOfBirth && typeof dateOfBirth === 'string') {
                    decryptedDateOfBirth = await apigeeClient.apigeeDecrypt(dateOfBirth);
                }
                if (mobileNumber && typeof mobileNumber === 'string') { // Only if MSSIDN is needed by DOPA
                    decryptedMobileNumber = await apigeeClient.apigeeDecrypt(mobileNumber);
                }
            } catch (decryptionError: any) {
                // If decryption fails, DOPA check cannot proceed meaningfully
                verifyResult.verifyDopaStatus = 'fail';
                // Propagate specific decryption error
                if (decryptionError.errorCode === "FAILED_TO_DECRYPT_DATA") {
                    throw decryptionError;
                }
                throw { statusCode: "500", statusMessage: "Critical input decryption failed", data: decryptionError };
            }

            const statesToVerify = Array.isArray(verifyState) ? verifyState : (verifyState ? [verifyState] : []);

            if (statesToVerify.includes('dopa')) {
                if (!decryptedCertificationId || !decryptedDateOfBirth) {
                    verifyResult.verifyDopaStatus = 'fail';
                } else {
                    const dopaInternalResult = await this.performDopaPopStatusVerification({
                        correlatorId: correlatorid,
                        idNumber: decryptedCertificationId,
                        dateOfBirth: decryptedDateOfBirth,
                        mobileNumber: decryptedMobileNumber,
                        journey: journey as CART_JOURNEYS
                    });
                    verifyResult.verifyDopaStatus = dopaInternalResult.status;
                }
            } else {
                verifyResult.verifyDopaStatus = 'skip'; // Skip if 'dopa' is not in verifyState
            }

            // Placeholder for Headless Non-Commerce logic (as per VECOM-4491, this is a stub for now)
            if (statesToVerify.includes('hlPreverFull') || statesToVerify.includes('hl4DScore')) {
                logger.info(`[Stub] Headless non-commerce verification would be called for states: ${statesToVerify.join(', ')}`);
                // const headlessParams = { /* ... */ };
                // const headlessResult = await this.verifyHeadlessNonCommerce(headlessParams);
                // Update verifyResult based on headlessResult (e.g., verifyLock3StepStatus, etc.)
                // For now, keeping them as 'skip' or their initial 'pending'
            }

            // return { verifyResult };
            return {
                // dopa: ...
                // headless: ...
            }
        }
    }

    private async performDopaPopStatusVerification(params: PerformDopaPopStatusVerificationParams): Promise<VerifyDopaInternalResult> {
        const logModel = LogModel.getInstance(); // Assumes LogModel is initialized by the caller
        const logStepModel = createLogModel(LOG_APPS.VERIFY, '[DOPA] Perform POP Status Verification', logModel);

        const apigeeClient = new ApigeeClientAdapter();

        // Date of Birth is already decrypted and expected to be DDMMYYYY.
        // Timestamp for DOPA request, using Asia/Bangkok timezone.
        const dopaTimestamp = dayjs().tz("Asia/Bangkok").format('YYYY-MM-DDTHH:mm:ss.SSSZ');

        const dopaApiPayload: VerifyDopaPOPStatusApiRequest = {
            verifyDopaPOPstatus: {
                requestId: params.correlatorId,
                channel: "ECP", // Fixed value from DOPA spec page 1
                idNumber: params.idNumber,     // Decrypted ID Card number
                dateOfBirth: params.dateOfBirth, // Decrypted DOB, format DDMMYYYY
                timeStamp: dopaTimestamp,
            }
        };

        // Add MSSIDN (decrypted mobile number) if available and journey requires it
        // For 'new_device_bundle', MSSIDN is optional in DOPA request.
        // It might be used for specific DOPA checks or logging.
        if (params.mobileNumber) {
            dopaApiPayload.verifyDopaPOPstatus.MSSIDN = params.mobileNumber;
        }

        logStepModel.request = dopaApiPayload; // Log the request payload to DOPA

        try {
            const response = await apigeeClient.verifyDopaPOPStatus(dopaApiPayload);
            logService(dopaApiPayload, response, logStepModel); // Log DOPA success response

            const { resultResponse } = response.data;

            if (resultResponse && resultResponse.resultCode === "200") {
                if (resultResponse.resultInfo && resultResponse.resultInfo.code === "00") {
                    // As per "TO BE" on DOPA spec page 3, flagBypass is now present
                    if (resultResponse.resultInfo.flagBypass === "N") {
                        return { status: 'success', dopaResponse: resultResponse.resultInfo };
                    } else if (resultResponse.resultInfo.flagBypass === "Y") {
                        return { status: 'bypass', dopaResponse: resultResponse.resultInfo };
                    } else {
                        // Fallback if flagBypass is missing or has an unexpected value, treat as fail.
                        return { status: 'fail', dopaResponse: resultResponse.resultInfo, errorMessage: "Missing or invalid flagBypass in DOPA success response" };
                    }
                } else {
                    // resultCode is 200, but resultInfo.code is not "00" (e.g., "04" or "06" from DOPA spec page 3)
                    // or resultInfo is missing
                    return { status: 'fail', dopaResponse: resultResponse.resultInfo, errorMessage: resultResponse.resultMessage || "DOPA verification failed with code: " + resultResponse.resultInfo?.code };
                }
            } else {
                // resultCode is not "200" (e.g., "421" from DOPA spec page 3)
                return { status: 'fail', dopaResponse: resultResponse?.resultInfo, errorMessage: resultResponse?.resultMessage || "DOPA verification returned non-200 result code" };
            }

        } catch (error: any) {
            logService(dopaApiPayload, error, logStepModel); // Log DOPA failure/error response
            if (error instanceof AxiosError && error.response) {
                // Handle specific HTTP status codes from APIGEE/DOPA
                // As per "Enhance auto bypass" on DOPA spec page 2 for 5xx errors
                if (error.response.status >= 500 && error.response.status <= 599) {
                    return { status: 'bypass', errorMessage: `DOPA Gateway error (HTTP ${error.response.status}): ${error.response.data?.message || error.message}` };
                }
                // For other HTTP errors (e.g., 4xx from APIGEE proxy itself)
                return { status: 'fail', errorMessage: `APIGEE/DOPA request failed (HTTP ${error.response.status}): ${error.response.data?.message || error.message}` };
            }
            // Network errors or other issues not related to HTTP response
            return { status: 'fail', errorMessage: error.message || 'Unknown error during DOPA POP status verification' };
        }
    }

    // Stub for Headless Non-Commerce Verification (Not part of VECOM-4491 minimal changes)
    private async verifyHeadlessNonCommerce(params: any): Promise<any> {
        // This would return a structure to populate parts of INewDeviceBundleVerifyResult
        return {
            // Example structure, to be defined by headless spec
            lock3StepStatus: 'skip',
            fortyFiveDayNonShopStatus: 'skip',
            thaiId5NumberStatus: 'skip',
            maxAllowStatus: 'skip',
            checkCrossStatus: 'skip',
            scoreStatus: 'skip',
            scoreValue: null,
            totalProductTrue: null,
        };
    }
}
