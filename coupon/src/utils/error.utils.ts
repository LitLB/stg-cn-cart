// cart/src/utils/error.utils.ts

import createError, { HttpError } from 'http-errors';
import { camelToUpperSnakeCase, camelToTitleCase } from './string.utils';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';
import { HTTP_STATUSES } from '../constants/http.constant';

/**
 * Generates a standardized error code from a given function name.
 * 
 * The provided function name is converted from camelCase/PascalCase to UPPER_CASE_SNAKE_CASE
 * and then appended with "_FAILED".
 * 
 * @example
 * generateFailedErrorCode("createAnonymousSession") 
 * // returns: "CREATE_ANONYMOUS_SESSION_FAILED"
 * 
 * @param functionName - The name of the function for which to generate the error code.
 * @returns A string representing the standardized error code.
 */
export function generateFailedErrorCode(functionName: string): string {
    return `${camelToUpperSnakeCase(functionName)}_FAILED`;
}

/**
 * Generates a standardized status message based on a given function name.
 * 
 * The provided function name is converted from camelCase/PascalCase to a title-cased string,
 * and "Failed." is appended to the end.
 * 
 * @example
 * generateFailedStatusMessage("createAnonymousSession")
 * // returns: "Create Anonymous Session Failed."
 * 
 * @param functionName - The name of the function for which to generate the status message.
 * @returns A user-friendly error message.
 */
export function generateFailedStatusMessage(functionName: string): string {
    return `${camelToTitleCase(functionName)} Failed.`;
}

/**
 * Creates a standardized HTTP error with custom properties.
 *
 * @param params - Parameters to define the error.
 * @param params.statusCode - HTTP status code.
 * @param params.statusMessage - Error message.
 * @param params.errorCode - Custom application error code.
 * @param params.data - Additional data related to the error.
 * @returns A standardized HttpError with custom properties.
 */
export function createStandardizedError(params: {
    statusCode: number;
    statusMessage?: string;
    errorCode?: string;
    data?: any;
}, fallbackFunctionName?: string): HttpError {
    const statusCode = params?.statusCode || HTTP_STATUSES.INTERNAL_SERVER_ERROR;
    const statusMessage = params?.statusMessage ||
        (fallbackFunctionName
            ? generateFailedStatusMessage(fallbackFunctionName)
            : EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR);

    // Create the error using http-errors
    const error = createError(statusCode, statusMessage) as HttpError;

    // Attach custom properties
    error.errorCode = params?.errorCode ||
        (fallbackFunctionName ? generateFailedErrorCode(fallbackFunctionName) : 'UNKNOWN_ERROR');
    error.data = params.data || null;

    return error;
}