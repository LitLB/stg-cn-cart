// coupon/src/utils/error.utils.ts

import { ApiResponse } from '../types/response.type';
import { EXCEPTION_MESSAGES } from './messages.utils';
import { camelToTitleCase, camelToUpperSnakeCase } from './string.utils';

/**
 * Generates a standardized error code based on the function name.
 * Example: "createAnonymousSession" -> "CREATE_ANONYMOUS_SESSION_FAILED"
 */
export function generateFailedErrorCode(functionName: string): string {
    return `${camelToUpperSnakeCase(functionName)}_FAILED`;
}

/**
 * Generates a standardized status message based on the function name.
 * Example: "createAnonymousSession" -> "Create Anonymous Session Failed."
 */
export function generateFailedStatusMessage(functionName: string): string {
    return `${camelToTitleCase(functionName)} Failed.`;
}

/**
 * Create a standardized error object for the service layer.
 * This can be used when `catch`ing errors in the service and re-throwing
 * them in a standard format.
 */
export function createStandardizedError(error: any, fallbackFunctionName?: string): ApiResponse {
    const statusCode = error?.statusCode || 500;
    const statusMessage = error?.statusMessage ||
        (fallbackFunctionName ? generateFailedStatusMessage(fallbackFunctionName) : EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR);
    const errorCode = error?.errorCode ||
        (fallbackFunctionName ? generateFailedErrorCode(fallbackFunctionName) : undefined);
    const data = error?.data || null;

    return {
        statusCode,
        statusMessage,
        errorCode,
        data,
    };
}

/**
 * Send a standardized error response from the controller layer.
 * Takes an error (already formatted) and returns the appropriate JSON response.
 */
export function sendCustomError(res: any, error: any): ApiResponse {
    const { statusCode = 500, statusMessage = EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR, errorCode, data = null } = error;
    return res.status(statusCode).json({
        statusCode,
        statusMessage,
        errorCode,
        data,
    });
}