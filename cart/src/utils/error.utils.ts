// cart/src/utils/error.utils.ts

import createError from 'http-errors';
import { camelToUpperSnakeCase, camelToTitleCase } from './string.utils';
import { ApiResponse } from '../interfaces/response.interface';
import { EXCEPTION_MESSAGES } from '../constants/messages.constant';

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
 * Creates a standardized HTTP error object using the `http-errors` library.
 * 
 * This function aims to produce a consistently formatted error that can be thrown from the service layer.
 * It accepts an incoming error (which may or may not have specific properties) and a fallback function name.
 * If certain properties are not defined in the original error, it uses:
 * - a default or fallback statusCode (default: 500)
 * - a default or fallback statusMessage derived from the provided fallback function name or a generic internal server error message
 * - a default or fallback errorCode derived from the provided fallback function name
 * - a default data object (null) if not provided
 * 
 * The returned object is an `http-errors` error instance with additional custom properties (`errorCode` and `data`).
 * This allows for easy integration with existing error-handling middleware and ensures all errors have a uniform structure.
 * 
 * @example
 * try {
 *   // some logic that throws error
 * } catch (error) {
 *   // If error is missing expected fields, fallback to standardized defaults:
 *   throw createStandardizedError(error, 'createAnonymousSession');
 * }
 * 
 * @param error - The original error object caught in the service. May contain partial or no expected fields.
 * @param fallbackFunctionName - A function name used to generate fallback statusMessage and errorCode if needed.
 * @returns An Error object with HTTP-friendly fields (`statusCode` and `message`) and custom properties (`errorCode` and `data`).
 */
export function createStandardizedError(error: any, fallbackFunctionName?: string): Error {
    const statusCode = error?.statusCode || 500;
    const statusMessage = error?.statusMessage ||
        (fallbackFunctionName
            ? generateFailedStatusMessage(fallbackFunctionName)
            : EXCEPTION_MESSAGES.INTERNAL_SERVER_ERROR);
    const errorCode = error?.errorCode ||
        (fallbackFunctionName ? generateFailedErrorCode(fallbackFunctionName) : undefined);
    const data = error?.data || null;

    const httpError = createError(statusCode, statusMessage);

    // Attach additional custom fields to the error
    (httpError as any).errorCode = errorCode;
    (httpError as any).data = data;

    return httpError;
}

/**
 * Sends a standardized error response from the controller layer.
 * 
 * This function is intended to be used in controller `catch` blocks. It takes an Error object that ideally was created or transformed by `createStandardizedError`, 
 * ensuring it has at least a `statusCode` and `message`. It then sends a JSON response to the client with a consistent structure:
 * 
 * {
 *   "statusCode": <number>,
 *   "statusMessage": <string>,
 *   "errorCode": <string | undefined>,
 *   "data": <any | null>
 * }
 * 
 * If any of these fields are missing, it uses sensible defaults:
 * - `statusCode` defaults to 500
 * - `statusMessage` defaults to a generic internal server error message
 * - `data` defaults to null if not provided
 * 
 * This ensures that every error response sent back to the client is uniform and easy to parse.
 * 
 * @param res - The Express response object.
 * @param error - The Error object to be sent to the client. Should ideally be from `createStandardizedError`.
 * @returns The standardized error response sent to the client.
 */
export function sendCustomError(res: any, error: any): ApiResponse {
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
