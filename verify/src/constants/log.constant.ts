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
    APIGEE_REQUEST_OTP = '[APIGEE] Request OTP',
    APIGEE_VERIFY_OTP = '[APIGEE] Verify OTP',
    APIGEE_CHECK_OPERATOR = '[APIGEE] Check operator',
    CT_CHECK_ACTIVE_OPERATOR = '[CT_CHECK_ACTIVE_OPERATOR] Check active operator in commercetools.',
}