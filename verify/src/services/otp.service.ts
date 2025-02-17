import moment from "moment";
import * as fs from 'fs';
import * as path from 'path';

import ApigeeClientAdapter from "../adapters/apigee-client.adapter";
import { readConfiguration } from "../utils/config.utils";
import { getOTPReferenceCodeFromArray } from "../utils/array.utils";
import { createLogModel, logger, LogModel, logService } from "../utils/logger.utils";
import { LOG_APPS, LOG_MSG } from "../constants/log.constant";
import { generateTransactionId } from "../utils/date.utils";
import { VerifyOTPToApigee } from "../interfaces/otp.interface";
import { convertToThailandMobile } from "../utils/formatter.utils";
import { validateOperator } from "../utils/operator.utils";

export class OtpService {

    private readonly config: any

    constructor() {
        this.config = readConfiguration()
    }

    public async requestOtp(phoneNumber: string) {
        const logModel = LogModel.getInstance();
        logModel.start_date = moment().toISOString();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_REQUEST_OTP, logModel);
        try {

            const apigeeClientAdapter = new ApigeeClientAdapter
            const transactionId = generateTransactionId()
            const sendTime = moment().format('YYYY-MM-DD[T]HH:mm:ss.SSS');
            const decryptedMobile = await apigeeClientAdapter.apigeeDecrypt(phoneNumber)
            const thailandMobile = convertToThailandMobile(decryptedMobile)

            const body = {
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

            const response = await apigeeClientAdapter.requestOTP(body)

            logService(body, response, logStepModel);

            const otpNumberMinuteExpire = this.config.otp.expireTime as number
            const otpNumberSecondResend = this.config.otp.resendTime as number

            const expireAt = moment(response.sendCompleteTime).add(otpNumberMinuteExpire, 'minutes').format('YYYY-MM-DDTHH:MM:SS+07:00')
            const refCode = getOTPReferenceCodeFromArray(response.characteristic) ?? "Invalid"

            const data = {
                otp: {
                    expireAt,
                    refCode
                },
                config: {
                    otpNumberMinuteExpire,
                    otpNumberSecondResend
                }
            }

            // ? INFO :: Might not add this code 
            this.createLogFile(phoneNumber, refCode, moment().format('YYYY-MM-DD HH:mm:ss'));


            return data
        } catch (e: any) {
            logService(phoneNumber, e, logStepModel);
            throw e
        }
    }

    public async verifyOtp(phoneNumber: string, refCode: string, pin: string) {
        const logModel = LogModel.getInstance();
        logModel.start_date = moment().toISOString();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_VERIFY_OTP, logModel);
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter
            const sendTime = moment().format('YYYY-MM-DD[T]HH:mm:ss.SSS');
            const decryptedMobile = await apigeeClientAdapter.apigeeDecrypt(phoneNumber)

            const thailandMobile = convertToThailandMobile(decryptedMobile)
            const body: VerifyOTPToApigee = {
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
                const otpErrorMap: Record<string, { status: number; statusCode: string; statusMessage: string; errorCode: string }> = {
                    '100001': {
                        status: 400,
                        statusCode: '400.4002',
                        statusMessage: 'OTP is not match',
                        errorCode: 'OTP_IS_NOT_MATCH'
                    },
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

                // Somewhere in your verifyOtp logic, check for error conditions:
                if (otpErrorMap[pin]) {
                    logService({ phoneNumber, refCode, pin }, otpErrorMap[pin], logStepModel);
                    throw otpErrorMap[pin];
                }

                // return {
                //     packageList: [
                //         {
                //             packageInfo: {
                //                 packageId: "4fa2c291-1fce-4389-a171-0369a33addb0",
                //                 packageName: "5G Together Device 1199_Voice 250min_Net Unltd",
                //                 priceplanRc: "899",
                //                 contractTerm: "12",
                //                 netInfo: "net 40 GB unlimited 100 Mbps",
                //                 voiceInfo: [
                //                     "call Unlimit True networks",
                //                     "call 400 mins all networks"
                //                 ],
                //                 wifiInfo: "wifi Unlimit @TRUE-WIFI",
                //                 additionalPackage: [
                //                     "รับชม ฟุตบอลพรีเมียร์ลีก ตลอดฤดูกาล 2023/24"
                //                 ]
                //             },
                //             campaignInfo: {
                //                 campaignName: "เฉพาะลูกค้า True Black Card",
                //                 customerTier: "BLACK",
                //                 price: "13599",
                //                 advanceService: "2000",
                //                 seq: 1
                //             }
                //         },
                //         {
                //             packageInfo: {
                //                 packageId: "4fa2c291-1fce-4389-a171-0369a33addb0",
                //                 packageName: "5G Together Device 1199_Voice 250min_Net Unltd",
                //                 priceplanRc: "899",
                //                 contractTerm: "12",
                //                 netInfo: "net 40 GB unlimited 100 Mbps",
                //                 voiceInfo: [
                //                     "call Unlimit True networks",
                //                     "call 400 mins all networks"
                //                 ],
                //                 wifiInfo: "wifi Unlimit @TRUE-WIFI",
                //                 additionalPackage: [
                //                     "รับชม ฟุตบอลพรีเมียร์ลีก ตลอดฤดูกาล 2023/24"
                //                 ]
                //             },
                //             campaignInfo: {
                //                 campaignName: "เฉพาะลูกค้า True Red Card",
                //                 customerTier: "RED",
                //                 price: "15599",
                //                 advanceService: "3000",
                //                 seq: 2
                //             }
                //         }
                //     ]
                // }

                return await this.checkOperator(phoneNumber)

            } else {
                const response = await apigeeClientAdapter.verifyOTP(body)
                logService(body, response, logStepModel);

                const checkedOperator = await this.checkOperator(phoneNumber)

                return checkedOperator
            }

        } catch (e: any) {
            logger.error(LOG_MSG.APIGEE_VERIFY_OTP)
            throw e
        }
    }

    private async checkOperator(phoneNumber: string) {
        const logModel = LogModel.getInstance();
        logModel.start_date = moment().toISOString();
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_CHECK_OPERATOR, logModel);
        try {

            const apigeeClientAdapter = new ApigeeClientAdapter

            const response = await apigeeClientAdapter.checkOperator(phoneNumber)

            validateOperator(response.operator)

            logService(phoneNumber, response, logStepModel);

            return response
        } catch (e: any) {
            logger.error(LOG_MSG.APIGEE_CHECK_OPERATOR)
            throw e
        }
    }

    private async createLogFile(phoneNumber: string, refCode: string, dateTime: string): Promise<void> {
        // Create a timestamp for the filename

        const apigeeClientAdapter = new ApigeeClientAdapter
        const decodePhoneNumber = await apigeeClientAdapter.apigeeDecrypt(phoneNumber)

        const logDirectory = path.resolve(__dirname, 'logs');

        // Create the logs directory if it doesn't exist
        if (!fs.existsSync(logDirectory)) {
            fs.mkdirSync(logDirectory, { recursive: true });
        }

        // Create a timestamp for the filename
        const timestamp = moment().format('YYYYMMDDHHmmss');
        const filename = path.join(logDirectory, `${timestamp}.log`);


        // Prepare the log content
        const content = [decodePhoneNumber, refCode, dateTime].join('|');

        // Write the log file asynchronously
        fs.writeFile(filename, content, (err) => {
            if (err) {
                console.error(`Error writing log file ${filename}:`, err);
            } else {
                console.log(`Log file ${filename} created successfully.`);
            }
        });
    }

}
