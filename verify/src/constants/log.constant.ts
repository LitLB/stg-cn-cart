export enum LOG_APPS {
    VERIFY = 'cn-cart-verify',
    STORE_WEB = 'store-web'
}

export const LOG_CHANNEL = "true-ecommerce";
export const LOG_PRODUCT = "true-ecommerce";

export enum LOG_LEVELS {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

export enum LOG_RESULT_INDICATOR {
    SUCCESS = 'SUCCESS',
    UNSUCCESS = 'UNSUCCESS',
}

export enum LOG_MSG {
    APIGEE_REQUEST_OTP = '[APIGEE] - Request OTP.',
    APIGEE_VERIFY_OTP = '[APIGEE] - Verify OTP.',
    APIGEE_CHECK_OPERATOR = '[APIGEE] - Check operator.',
    APIGEE_GET_PROFILE_AND_PACKAGE = '[APIGEE] - Get profile and package',
    APIGEE_CHECK_BACKLIST = '[APIGEE] - Check backlist.',
    CT_CHECK_OPERATOR_JOURNEY_ACTIVATION = '[CommerceTools] Check operator journey activation.',
}