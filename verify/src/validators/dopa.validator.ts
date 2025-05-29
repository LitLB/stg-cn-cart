// verify/src/validators/dopa.validator.ts

import { STATUS_CODES } from "../constants/http.constant";

export class DopaValidator {
    public static handleVerifyDopaStatus = (isVerifyDopaStatusValid: boolean): void => {
        if (!isVerifyDopaStatusValid) {
            throw {
                statusCode: STATUS_CODES.VERIFY_DOPA_FAIL,
                statusMessage: "Verify DOPA fail",
            }
        }
    }

    public static checkIsVerifyDopaStatusValid = (verifyDopaStatus: string): boolean => {
        if (verifyDopaStatus === 'fail') {
            return false
        }

        return true;
    }
}