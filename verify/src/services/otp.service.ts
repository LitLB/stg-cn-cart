// src/services/otp.service.ts

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone"; // Required for specific timezone formatting
import ApigeeClientAdapter, { apigeeClientAdapter } from "../adapters/apigee-client.adapter";
import { hlClientAdapter } from '../adapters/headless-client.adapter'
import { readConfiguration } from "../utils/config.utils";
import { getOTPReferenceCodeFromArray } from "../utils/array.utils";
import { formatDateFromString, generateTransactionId } from "../utils/date.utils";
import { convertToThailandMobile } from "../utils/formatter.utils";
import { validateOperator } from "../utils/operator.utils";
import CommercetoolsCustomObjectClient from "../adapters/ct-custom-object-client"
import { getValueByKey } from "../utils/object.utils";
import { createLogModel, generateUUID, logger, LogModel, logService } from "../utils/logger.utils";
import { LOG_APPS, LOG_MSG } from "../constants/log.constant";
import { OPERATOR } from "../constants/operator.constant";
import { validateContractAndQuotaDtac, validateContractAndQuotaTrue, validateCustomerDtacProfile, validateCustomerTrueProfile, validateSharePlan } from "../validators/operator.validators";
import { encryptedOFB } from "../utils/apigeeEncrypt.utils";
import { CustomerVerificationData, CustomerVerifyQueryParams, ICustomerProfile, BLACKLIST_COLORS } from "../interfaces/verify.interface";
import { CART_JOURNEYS } from "../constants/cart.constant";
import { STATUS_CODES } from "http";
import { EXCEPTION_MESSAGES } from "../constants/messages.constant";
import { CUSTOMER_VERIFY_STATES } from "../constants/ct.constant";
import { VERIFY_DOPA_POP_STATUS_CHANNEL, VERIFY_HL_CHANNEL, VERIFY_HL_CUSTOMER_TYPE, VERIFY_HL_VALIDATE_NAME, VERIFY_HL_VALIDATE_FUNCTION, VERIFY_HL_DEALERCODE, VERIFY_HL_COMPANY_CODE, VERIFY_HL_ACTIVITYFUNCTION, VERIFY_HL_ACTIVITYFUNCTIONTYPE, VERIFY_HL_USERLOGIN, VERIFY_HL_ACCOUNTYPE } from "../constants/verify.constant";
import { DopaValidator } from "../validators/dopa.validator";
import { HLValidator } from '../validators/hl.validator'

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

    public async getCustomerProfile(id: string, journey: string, verifyStates: string[], mobileNumber: string, certificationId: string, dateOfBirth: string, certificationType?: string) {

        const steps = new Set(verifyStates);
        let operator: typeof OPERATOR[keyof typeof OPERATOR] = 'unknown';
        const response: CustomerVerificationData = {
            verifyResult: {},
            customerProfile: {
                operator: "unknown",
                companyCode: "unknown",
                birthdate: "unknown",
                certificationType: '',
                certificationId: ''
            }
        }

        let customerProfile


        // Step 2: Check operator and Active company

        if (steps.has("operator")) {
            const verifyKeyOption = journey
                    ? await CommercetoolsCustomObjectClient.getCustomObjectByContainerAndKey("verifyKeyOptions", journey)
                    : undefined;
            if (verifyKeyOption?.value.cerId) {
                operator = await this.checkProductIsTrue(certificationId, dateOfBirth, certificationType);
            } else {
                operator = await this.checkOperator(id, mobileNumber);
            }
            await this.checkActive(journey, operator);
            response.verifyResult.verifyOperatorStatus = "success";
            response.customerProfile.operator = operator
        }



        // Step 3: Check Profile and Share plan.
        if (steps.has("profileAndPackage") || steps.has("sharePlan")) {
            const [profileRes, _sharePlan] = await Promise.all([
                steps.has("profileAndPackage")
                    ? this.getProfileAndPackage(id, operator, mobileNumber)
                    : Promise.resolve(undefined),
                steps.has("sharePlan")
                    ? this.checkSharePlan(operator, mobileNumber)
                    : Promise.resolve(undefined),
            ]);

            if (_sharePlan === undefined && steps.has("sharePlan")) {
                response.verifyResult.verifySharePlanStatus = "success";
            }

            if (profileRes) {

                if (operator === OPERATOR.TRUE) {
                    customerProfile = validateCustomerTrueProfile(profileRes.data);
                }
                if (operator === OPERATOR.DTAC) {
                    customerProfile = validateCustomerDtacProfile(profileRes.data);
                }
                response.verifyResult.verifyCustomerAndPackageStatus = "success";

                if (customerProfile) {

                    const decryptedThaiId = await apigeeClientAdapter.apigeeDecrypt(customerProfile.certificationId)

                    response.customerProfile = {
                        companyCode: customerProfile.companyCode,
                        customerNumber: customerProfile.customerNo ?? undefined,
                        customerType: customerProfile.customerType ?? undefined,
                        isProductTrue: journey === CART_JOURNEYS.DEVICE_BUNDLE_EXISTING ? OPERATOR.TRUE : '?', // TODO :: for bundle new  
                        packageCode: customerProfile.packageCode ?? undefined,
                        pricePlan: customerProfile.pricePlan ?? undefined,
                        birthdate: customerProfile.birthOfDate,
                        ageOfUse: customerProfile.aging ?? undefined,
                        certificationId: decryptedThaiId,
                        certificationType: 'I'

                    }
                }
            }
        }

        // Step 4: Check Blacklist and Contract/Quota
        if ((steps.has("blacklist") || steps.has("contractAndQuota")) && customerProfile) {
            const { certificationId, customerNo, agreementId } = customerProfile;

            if (steps.has("blacklist")) {
                await this.checkBacklist(id, operator, certificationId, customerNo);
                response.verifyResult.verifyBlacklistStatus = "success";
            }

            if (steps.has("contractAndQuota")) {
                await this.checkContractAndQuota(
                    id,
                    operator,
                    certificationId,
                    agreementId
                );
                response.verifyResult.verifyContractStatus = "success";
            }

        }



        return response;
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
        if (operator !== OPERATOR.TRUE && operator !== OPERATOR.DTAC) {
            throw {
                statusCode: "400.4010",
                statusMessage: 'Get profile info fail',
                errorCode: 'GET_PROFILE_INFO_FAIL'
            };
        }

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

        if (operator !== OPERATOR.TRUE && operator !== OPERATOR.DTAC) {
            throw {
                statusCode: "400.4010",
                statusMessage: 'Get profile info fail',
                errorCode: 'GET_PROFILE_INFO_FAIL'
            };
        }

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

    public async getCustomerTier(id: string, mobileNumber: string) {


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
        const stringBody =
            `id=${correlatorid}` +
            `&channel=${VERIFY_DOPA_POP_STATUS_CHANNEL.ECP}` +
            `&engagedParty.id=${decryptedCertificationId}` +
            `&individual.birthDate=${decryptedDateOfBirth}` +
            `&validFor.startDateTime=${new Date()}`;

        const response: CustomerVerificationData = {
            verifyResult: {
                verifyDopaStatus: 'skip',
            },
            customerProfile: {
                companyCode: "unknown",
                birthdate: "unknown",
                operator: "unknown",
                certificationId: decryptedCertificationId,
                certificationType: 'I'
            }
        }

        const verifyDopaPOPStatusRequestBodyEncrypt = await apigeeClientAdapter.apigeeEncrypt(stringBody);
        const verifyDopaPOPStatusResponse = await apigeeClientAdapter.verifyDopaPOPStatus(verifyDopaPOPStatusRequestBodyEncrypt);
        const { status: resultCode, data: resultInfo } = verifyDopaPOPStatusResponse || {};
        const { status: code, isByPass: flagBypass } = resultInfo

        if (resultCode !== 200) {
            if (code === '500.599.2000')  {
                response.verifyResult.verifyDopaStatus = 'skip';
            } else {
                response.verifyResult.verifyDopaStatus = 'fail';
            }
        } else if (resultCode === 200 && code !== '00') {
            if (flagBypass === 'Y') {
                response.verifyResult.verifyDopaStatus = 'bypass';
            } else {
                response.verifyResult.verifyDopaStatus = 'fail';
            }
        } else if (resultCode === 200 && code === '00') {
            if (flagBypass === 'Y') {
                response.verifyResult.verifyDopaStatus = 'bypass';
            } else {
                response.verifyResult.verifyDopaStatus = 'success';
            }
        }

        const isVerifyDopaStatusValid = DopaValidator.checkIsVerifyDopaStatusValid(response?.verifyResult?.verifyDopaStatus || "");
        DopaValidator.handleVerifyDopaStatus(isVerifyDopaStatusValid);

        return response;
    }

    private async performHLPreVerifyStatus(
        journey: string,
        certificationId: string,
        decryptedCertificationId: string,
        dateOfBirth: string,
        decryptedDateOfBirth: string,
        certificationType?: string,
        verifyState?: string,
        campaignCode?: string,
        productCode?: string,
        propoId?: string,
        
    ): Promise<CustomerVerificationData> {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_OPERATOR, logModel);

        const response: CustomerVerificationData = {
            verifyResult: {},
            customerProfile: {
                operator: "true",
                companyCode: "RF",
                birthdate: "",
                certificationId: decryptedCertificationId,
                certificationType: certificationType || ""
            }
        };

        // 1.convert date to dd/mm/yyyy
        let birthDate = decryptedDateOfBirth;
        response.customerProfile.birthdate = birthDate;
        
        if (birthDate) { 
            birthDate = formatDateFromString(birthDate)
            dateOfBirth = await apigeeClientAdapter.apigeeEncrypt(birthDate);
        }

        // 2.base payload
        const basePayload = {
            correlationId: generateUUID(),
            channel: VERIFY_HL_CHANNEL.ECP,
            customerInfo: {
                identification: certificationId,
                identificationType: certificationType || "",
                birthDate: dateOfBirth,
                customerType: VERIFY_HL_CUSTOMER_TYPE.I
            }
        };

        let requestBody;
        let hlResponse;

        // 3.call hl
        switch (verifyState) {
            case "hlPreverFull":
                response.verifyResult.verifyLock3StepStatus = "fail",
                response.verifyResult.verify45DayNonShopStatus = "fail",
                response.verifyResult.verifyThaiId5NumberStatus  = "fail",
                response.verifyResult.verifyMaxAllowStatus  = "fail",
                response.verifyResult.verifyCheckCrossStatus  = "fail"

                requestBody = {
                    correlationId: basePayload.correlationId,
                    channel: basePayload.channel,
                    dealerCode: VERIFY_HL_DEALERCODE.CODE_80001999,
                    companyCode: VERIFY_HL_COMPANY_CODE.AL,
                    propoId: propoId,
                    activityFunction: VERIFY_HL_ACTIVITYFUNCTION.NEW,
                    activityFunctionType: VERIFY_HL_ACTIVITYFUNCTIONTYPE.PRIVILEGE,
                    userLogin: VERIFY_HL_USERLOGIN.CVECOM03,
                    customerInfo: {
                        ...basePayload.customerInfo,
                        accountType: VERIFY_HL_ACCOUNTYPE.RPI,
                        requestSubscriber: "1"
                    },
                    validate: [
                        {
                            name: VERIFY_HL_VALIDATE_NAME.PREVERFULLRESULT,
                            function: [VERIFY_HL_VALIDATE_FUNCTION.THAIDID5NUMBER, VERIFY_HL_VALIDATE_FUNCTION.MAXALLOW]
                        }
                    ]
                };

                hlResponse = await hlClientAdapter.verifyHLStatus(requestBody);
                logService(requestBody, hlResponse, logStepModel)

                const mapStatus = HLValidator.handleVerifyHLStatus(hlResponse?.code)
                if (mapStatus) throw mapStatus;

                response.verifyResult.verifyLock3StepStatus = "success",
                response.verifyResult.verify45DayNonShopStatus = "success",
                response.verifyResult.verifyThaiId5NumberStatus  = "success",
                response.verifyResult.verifyMaxAllowStatus  = "success",
                response.verifyResult.verifyCheckCrossStatus  = "success"
                break;
            
            case "hl4DScore":
                response.verifyResult.verify4DScoreStatus = "fail"
                response.verifyResult.verify4DScoreValue = null
                response.verifyResult.totalProductTrue = null

                requestBody = {
                    correlationId: basePayload.correlationId,
                    channel: basePayload.channel,
                    campaignInfo: {
                        campaignCode: campaignCode,
                        productCode: productCode
                    },
                    customerInfo: {
                        ...basePayload.customerInfo,
                    },
                    validate: [
                        {
                            name: VERIFY_HL_VALIDATE_NAME.FOURDSCORE,
                            function: []
                        }
                    ]
                };

                hlResponse = await hlClientAdapter.verifyHLStatus(requestBody);
                logService(requestBody, hlResponse, logStepModel)

                if (hlResponse?.code === "200") {
                    response.verifyResult.verify4DScoreStatus = "success"
                    response.verifyResult.verify4DScoreValue = hlResponse.data.blacklistColor as BLACKLIST_COLORS;
                    response.verifyResult.totalProductTrue = hlResponse.data.totalProduct as unknown as string;
                    response.blacklistColor = hlResponse.data.blacklistColor as BLACKLIST_COLORS;
                    response.hasProduct = hlResponse.data.hasProduct as unknown as string;
                    response.totalProduct = hlResponse.data.totalProduct as unknown as string;
                }
                break;

            case "hlCheckProductIsTrue":
                response.verifyResult.verifyProductIsTrue = "fail"
                response.verifyResult.verifyProductIsTrueValue = null
                
                requestBody = {
                    correlationId: basePayload.correlationId,
                    channel: basePayload.channel,
                    customerInfo: {
                        ...basePayload.customerInfo
                    },
                    validate: [
                        {
                            name: VERIFY_HL_VALIDATE_NAME.CHECKPRODUCTISTRUE,
                            function: [VERIFY_HL_VALIDATE_FUNCTION.ALL]
                        }
                    ]
                };
                
                const verifyKeyOption = journey
                    ? await CommercetoolsCustomObjectClient.getCustomObjectByContainerAndKey("verifyKeyOptions", journey)
                    : undefined;

                if (verifyKeyOption?.value.cerId) {
                    hlResponse = await hlClientAdapter.verifyHLStatus(requestBody);
                    logService(requestBody, hlResponse, logStepModel)
                    if (hlResponse?.code === "200") {
                        response.customerProfile.isProductTrue = hlResponse?.data?.isProductTrue == true ? "true" : "false";
                        response.verifyResult.verifyProductIsTrue = "success";
                        response.verifyResult.verifyProductIsTrueValue = hlResponse.data.isProductTrue;
                    }
                }
                break;

            case "hlCheck3Oper":
                response.verifyResult.verifyCheck3Oper = "fail"
                response.verifyResult.verifyCheck3OperValue = null

                requestBody = {
                    correlationId: basePayload.correlationId,
                    channel: basePayload.channel,
                    campaignInfo: {
                        campaignCode: campaignCode,
                        productCode: productCode
                    },
                    customerInfo: {
                        ...basePayload.customerInfo,
                    },
                    validate: [
                        {
                            name: VERIFY_HL_VALIDATE_NAME.CHECK3OPER,
                            function: []
                        }
                    ]
                };

                hlResponse = await hlClientAdapter.verifyHLStatus(requestBody);
                logService(requestBody, hlResponse, logStepModel)

                if (hlResponse?.code === "200") {
                    response.verifyResult.verifyCheck3Oper = "success"
                    response.verifyResult.verifyCheck3OperValue = hlResponse?.data || null
                }
                break;

            default:
                throw new Error(`This verifyState = ${String(verifyState)} is unsupported`);
        }
        return response;
    }

    private async _handleVerificationByState(
        journey: string,
        verifyState: string | undefined,
        correlatorid: string,
        certificationId: string,
        dateOfBirth: string,
        decryptedCertificationId: string,
        decryptedDateOfBirth: string,
        decryptedMobileNumber?: string,
        certificationType?: string,
        campaignCode?: string,
        productCode?: string,
        propoId?: string,

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
            case CUSTOMER_VERIFY_STATES.hl4DScore:
            case CUSTOMER_VERIFY_STATES.hlCheckProductIsTrue:
            case CUSTOMER_VERIFY_STATES.hlCheck3Oper:
                return this.performHLPreVerifyStatus(
                    journey,
                    certificationId,
                    decryptedCertificationId,
                    dateOfBirth,
                    decryptedDateOfBirth,
                    certificationType,
                    verifyState,
                    campaignCode,
                    productCode,
                    propoId
                );
            default:
                throw new Error(`This verifyState = ${String(verifyState)} is unsupported`);
        }
    }

    private async checkProductIsTrue(certificationId: string, dateOfBirth: string, certificationType?: string) {
        const logModel = LogModel.getInstance();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_OPERATOR, logModel);
        let checkPayload

        let birthDate = await apigeeClientAdapter.apigeeDecrypt(dateOfBirth);
        if (birthDate) { 
            birthDate = formatDateFromString(birthDate)
            dateOfBirth = await apigeeClientAdapter.apigeeEncrypt(birthDate);
        }

        const basePayload = {
            correlationId: generateUUID(),
            channel: VERIFY_HL_CHANNEL.ECP,
            customerInfo: {
                identification: certificationId,
                identificationType: certificationType || "",
                birthDate: dateOfBirth,
                customerType: VERIFY_HL_CUSTOMER_TYPE.I
            },
            validate: [
                {
                    name: VERIFY_HL_VALIDATE_NAME.CHECKPRODUCTISTRUE,
                    function: [VERIFY_HL_VALIDATE_FUNCTION.ALL]
                }
            ]
        };

        try {
            const response = await hlClientAdapter.verifyHLStatus(basePayload);
            logService(checkPayload, response, logStepModel)
            if (response?.code === "200") {
                    if (response.data?.isProductTrue) {
                        return "true"
                    } else {
                        return "dtac"
                    }
            } else {
                throw {
                    statusCode: "400.4005",
                    statusMessage: 'Operator not TRUE or DTAC',
                    errorCode: 'OPERATOR_NOT_TRUE_OR_DTAC'
                }
            }
        } catch (e: any) {
            logService(checkPayload, e, logStepModel)
            throw e
        }
    }

    public async handleCustomerVerification(
        correlatorid: string,
        queryParams: CustomerVerifyQueryParams
    ): Promise<CustomerVerificationData> {
        try {
            const {
                journey,
                certificationId,
                dateOfBirth,
                mobileNumber,
                certificationType, // string - for headless
                campaignCode,      // string - for headless
                productCode,       // string - for headless
                propoId,           // string - for headless
                verifyState,
            } = queryParams;

            const verifyStateArr: Array<string> = [verifyState].flat();

            if (journey === CART_JOURNEYS.DEVICE_ONLY || journey === CART_JOURNEYS.DEVICE_BUNDLE_EXISTING) {
                const mobileNumberStr = queryParams.mobileNumber as string;
                const customerProfile = await this.getCustomerProfile(correlatorid, journey, verifyStateArr, mobileNumberStr, certificationId, dateOfBirth, certificationType);
                return customerProfile;
            } else {
                const decryptedCertificationId = await apigeeClientAdapter.apigeeDecrypt(certificationId);
                const decryptedDateOfBirth = await apigeeClientAdapter.apigeeDecrypt(dateOfBirth);
                const decryptedMobileNumber = mobileNumber ? await apigeeClientAdapter.apigeeDecrypt(mobileNumber) : undefined;

                const verifyStatePromises = verifyStateArr.map((currentState) => this._handleVerificationByState(
                    journey,
                    currentState,
                    correlatorid,
                    certificationId,
                    dateOfBirth,
                    decryptedCertificationId,
                    decryptedDateOfBirth,
                    decryptedMobileNumber,
                    certificationType,
                    campaignCode,
                    productCode,
                    propoId
                ))
                const verifyStateResults = await Promise.all(verifyStatePromises);

                const initialAccumulator: CustomerVerificationData = {
                    verifyResult: {},
                    customerProfile: {
                        companyCode: "",
                        birthdate: "",
                        operator: "",
                        certificationType: "",
                        certificationId: "I"
                    }
                }
                const mergedCustomerVerificationData: CustomerVerificationData = verifyStateResults.reduce((accumulator: CustomerVerificationData, currentValue: CustomerVerificationData) => {
                    return {
                        ...accumulator,
                        ...currentValue,
                        verifyResult: { ...accumulator.verifyResult, ...currentValue.verifyResult },
                        customerProfile: {...accumulator.customerProfile,...currentValue.customerProfile}
                    };
                }, initialAccumulator);

                return mergedCustomerVerificationData;
            }
        } catch (error: any) {
            logger.error(`OtpService.handleCustomerVerification.error`, error);

            if (error?.response?.data?.code || error?.statusCode) {
                throw error;
            }

            throw {
                statusCode: STATUS_CODES.DESTINATION_ERROR_500,
                statusMessage: EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR,
            }
        }
    }
}
