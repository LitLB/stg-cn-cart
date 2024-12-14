// cart/src/utils/error.utils.ts

import { Response } from 'express';
import createError, { HttpError } from 'http-errors';
import { camelToUpperSnakeCase, camelToTitleCase } from './string.utils';
import { ApiResponse } from '../interfaces/response.interface';
import { CustomError } from './custom-error.utils';
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

/**
 * Creates a standardized HTTP error object using the `http-errors` library.
 * Prevents double wrapping by returning the error as-is if it's already standardized.
 */
export function createStandardizedErrorV3(error: any, fallbackFunctionName?: string): Error {
    console.log('createStandardizedError.error', error);

    // Check if the error is already standardized
    if (error?.statusCode) {
        return error;
    }

    const statusCode = error?.statusCode || 500;
    const statusMessage = error?.statusMessage ||
        (fallbackFunctionName
            ? generateFailedStatusMessage(fallbackFunctionName)
            : EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR);
    const errorCode = error?.errorCode ||
        (fallbackFunctionName ? generateFailedErrorCode(fallbackFunctionName) : 'UNKNOWN_ERROR');
    const data = error?.data || null;

    const httpError = createError(statusCode, statusMessage);

    // Attach additional custom fields to the error
    (httpError as any).errorCode = errorCode;
    (httpError as any).data = data;

    console.log('httpError', httpError);

    return httpError;
}

/**
 * Sends a standardized error response from the controller layer.
 */
export function sendCustomError(res: any, error: any): ApiResponse {
    console.log('sendCustomError.error', error);

    const statusCode = error.statusCode || 500;
    const statusMessage = error.message || EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR;
    const errorCode = error.errorCode;
    const data = error.data || null;

    return res.status(statusCode).json({
        statusCode,
        statusMessage,
        errorCode,
        data,
    });
}

/**
 * Creates a standardized error using the CustomError class.
 * 
 * @param params - Parameters to create the error.
 * @param context - Optional context string indicating where the error originated.
 * @returns An instance of CustomError.
 */
export function createStandardizedErrorV2(error: {
    statusCode: number;
    statusMessage: string;
    errorCode?: string;
    data?: any;
}, fallbackFunctionName?: string): CustomError {
    const statusCode = error?.statusCode || 500;
    const statusMessage = error?.statusMessage ||
        (fallbackFunctionName
            ? generateFailedStatusMessage(fallbackFunctionName)
            : EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR);
    const errorCode = error?.errorCode ||
        (fallbackFunctionName ? generateFailedErrorCode(fallbackFunctionName) : undefined);
    const data = error?.data || null;

    const customError = new CustomError(statusCode, statusMessage, errorCode, data);

    console.log(customError);

    return customError;
}

/**
 * Sends a standardized error response to the client.
 * 
 * @param res - Express Response object.
 * @param error - The CustomError object containing statusCode, statusMessage, errorCode, and data.
 * @returns The standardized error response sent to the client.
 */
export function sendCustomErrorV2(res: Response, error: CustomError): Response<ApiResponse> {
    console.log('error', error);
    const { statusCode, message: statusMessage, errorCode, data = null } = error;

    const response: ApiResponse = {
        statusCode,
        statusMessage,
        errorCode,
        data,
    };

    return res.status(statusCode).json(response);
}