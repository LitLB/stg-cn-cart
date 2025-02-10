import moment from "moment";
import * as fs from 'fs';
import * as path from 'path';

import ApigeeClientAdapter from "../adapters/apigee-client.adapter";
import { readConfiguration } from "../utils/config.utils";
import { getOTPReferenceCodeFromArray } from "../utils/array.utils";

export class OtpService {

    private readonly config: any

    constructor() {
        this.config = readConfiguration()
    }

    public async requestOtp(phoneNumber: string) {
        try {

            const apigeeClientAdapter = new ApigeeClientAdapter
            const apigeeResponse = await apigeeClientAdapter.requestOTP(phoneNumber)

            const otpNumberMinuteExpire = parseInt(this.config.otp.expireTime)
            const otpNumberSecondResend = parseInt(this.config.otp.resendTime)

            const expireAt = moment(apigeeResponse.sendCompleteTime).add(otpNumberMinuteExpire, 'minutes').format('YYYY-MM-DDTHH:MM:SS+07:00')
            const refCode = getOTPReferenceCodeFromArray(apigeeResponse.characteristic) ?? "Invalid"

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

            this.createLogFile(phoneNumber, refCode, moment().format('YYYY-MM-DD HH:mm:ss'));


            return data
        } catch (e: any) {

            throw new Error(`Failed to request OTP: ${e.message}`)
        }
    }

    public verifyOtp() {
        // Implementation to verify OTP sent to user
        // Return true if OTP is verified successfully, false otherwise
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
