import moment from "moment";
import * as fs from 'fs';
import * as path from 'path';

import ApigeeClientAdapter from "../adapters/apigee-client.adapter";
import { readConfiguration } from "../utils/config.utils";
import { getOTPReferenceCodeFromArray } from "../utils/array.utils";
import { createLogModel, LogModel, logService } from "../utils/logger.utils";
import { LOG_APPS, LOG_MSG } from "../constants/log.constant";
import { generateTransactionId } from "../utils/date.utils";
import { VerifyOTPToApigee } from "../interfaces/otp.interface";

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

            const body = {
                id: transactionId,
                sendTime: sendTime,
                description: "TH", // * FIX
                channel: "true", // * FIX
                code: "220594", // * PENDING TO CONFIRM
                receiver: [
                    {
                        phoneNumber: decryptedMobile,
                        relatedParty: {
                            id: "VC-ECOM" // * CONFIRM ??
                        }
                    }
                ]
            }

            const response = await apigeeClientAdapter.requestOTP(body)

            logService(body, response, logStepModel);

            const otpNumberMinuteExpire = parseInt(this.config.otp.expireTime)
            const otpNumberSecondResend = parseInt(this.config.otp.resendTime)

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
        const logStepModel = createLogModel(LOG_APPS.STORE_WEB, LOG_MSG.APIGEE_REQUEST_OTP, logModel);
        try {
            const apigeeClientAdapter = new ApigeeClientAdapter
            const sendTime = moment().format('YYYY-MM-DD[T]HH:mm:ss.SSS');

            const body: VerifyOTPToApigee = {
                id: refCode,
                sendTime: sendTime,
                description: "TH", // * FIX
                channel: "true", // * FIX
                code: "220594", // * PENDING TO CONFIRM ??
                content: pin,
                receiver: [
                    {
                        phoneNumber: phoneNumber,
                        relatedParty: {
                            id: "VC-ECOM" // * CONFIRM ??
                        }
                    }
                ]
            }

            const isMockOtp = this.config.otp.isMock as boolean

            if (!isMockOtp) {
                // Define the error map for OTP errors
                const otpErrorMap: Record<string, { statusCode: string; statusMessage: string; errorCode: string }> = {
                    '100001': { statusCode: '400.4002', statusMessage: 'OTP is not match', errorCode: 'OTP_VERIFY_FIELD' },
                    '100002': { statusCode: '400.4003', statusMessage: 'OTP is not match for 5 times', errorCode: 'OTP_VERIFY_FIELD' },
                    '100003': { statusCode: '400.4004', statusMessage: 'OTP has expired', errorCode: 'OTP_VERIFY_FIELD' },
                    '100004': { statusCode: '400.4005', statusMessage: 'Operator not TRUE or DTAC', errorCode: 'OTP_VERIFY_FIELD' },
                    '100005': { statusCode: '400.4016', statusMessage: 'Get operator fail', errorCode: 'OTP_VERIFY_FIELD' },
                    '100006': { statusCode: '400.4006', statusMessage: 'Black listed customer is not allowed', errorCode: 'OTP_VERIFY_FIELD' },
                    '100007': { statusCode: '400.4007', statusMessage: 'Get customer tier fail', errorCode: 'OTP_VERIFY_FIELD' },
                    '100008': { statusCode: '400.4008', statusMessage: 'Get contract fail', errorCode: 'OTP_VERIFY_FIELD' },
                    '100009': { statusCode: '400.4009', statusMessage: 'Get package info fail', errorCode: 'OTP_VERIFY_FIELD' },
                    '100010': { statusCode: '400.4010', statusMessage: 'Get profile info fail', errorCode: 'OTP_VERIFY_FIELD' },
                    '100011': { statusCode: '400.4011', statusMessage: 'Subscriber type is not postpaid', errorCode: 'OTP_VERIFY_FIELD' },
                    '100012': { statusCode: '400.4012', statusMessage: 'Get quota fail', errorCode: 'OTP_VERIFY_FIELD' },
                    '100013': { statusCode: '400.4013', statusMessage: 'Not allowed to extend contract', errorCode: 'OTP_VERIFY_FIELD' },
                    '100014': { statusCode: '400.4014', statusMessage: 'Offer package not found', errorCode: 'OTP_VERIFY_FIELD' },
                    '100015': { statusCode: '400.4015', statusMessage: 'Get offer package fail', errorCode: 'OTP_VERIFY_FIELD' },
                    '100016': { statusCode: '500.9999', statusMessage: 'Unknown error', errorCode: 'OTP_VERIFY_FIELD' }
                };

                // Somewhere in your verifyOtp logic, check for error conditions:
                if (otpErrorMap[pin]) {
                    logService({ phoneNumber, refCode, pin }, otpErrorMap[pin], logStepModel);
                    throw otpErrorMap[pin];
                }

                return {}


            } else {
                const response = await apigeeClientAdapter.verifyOTP(body)
                logService(body, response, logStepModel);
                return response
            }

        } catch (e: any) {
            console.log(e.data)
            // logService({ phoneNumber, refCode, pin }, e, logStepModel);
            throw e
        }
    }

    /**
   * Creates a log file where:
   * - The filename is a timestamp (e.g., "20250209123045.log")
   * - The file content includes the mobile number, reference code, and date/time.
   *
   * @param phoneNumber The mobile number for which OTP was requested.
   * @param refCode The OTP reference code.
   * @param dateTime The current date and time.
   */
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
