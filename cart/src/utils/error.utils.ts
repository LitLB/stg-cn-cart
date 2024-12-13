// cart/src/utils/error.utils.ts

import { camelToUpperSnakeCase, camelToTitleCase } from './string.utils';
import { ResponseType } from '../types/response.type';
import { EXCEPTION_MESSAGES } from '../constants/messages.utils';

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

export function formatError(error: any, fallbackFunctionName?: string): ResponseType {
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