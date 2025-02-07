import moment from "moment";
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

            const data = {
                otp: {
                    refCode: getOTPReferenceCodeFromArray(apigeeResponse.characteristic),
                    expireAt
                },
                config: {
                    otpNumberMinuteExpire,
                    otpNumberSecondResend
                }
            }

            return data
        } catch (e: any) {

            throw new Error(`Failed to request OTP: ${e.message}`)
        }
    }

    public verifyOtp() {
        // Implementation to verify OTP sent to user
        // Return true if OTP is verified successfully, false otherwise
    }

}
