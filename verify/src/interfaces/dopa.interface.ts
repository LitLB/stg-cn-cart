// verify/src/interfaces/dopa.interface.ts

import { CART_JOURNEYS } from "../constants/cart.constant";
import { VerificationStatus } from "./verify.interface"; // Import new type

/**
 * Request payload for the verifyDopaPOPstatus APIGEE endpoint.
 */
export interface VerifyDopaPOPStatusRequestPayload {
    requestId: string;
    channel: string;
    MSSIDN?: string; // Optional, used for new_device_bundle journey
    idNumber: string;
    dateOfBirth: string; // Format: DDMMYYYY
    timeStamp: string;   // Format: ISO 8601
}

/**
 * Main request structure for the verifyDopaPOPstatus APIGEE endpoint.
 */
export interface VerifyDopaPOPStatusApiRequest {
    verifyDopaPOPstatus: VerifyDopaPOPStatusRequestPayload;
}

/**
 * Structure of the resultInfo object within the DOPA API response.
 */
export interface DopaResultInfo {
    code: string;
    desc: string;
    flagBypass?: 'Y' | 'N'; // Made optional as per observation of DOPA spec page 3 (AS-IS vs TO-BE)
    timeStamp: string;
}

/**
 * Structure of the resultResponse object from the DOPA API.
 */
export interface DopaResultResponse {
    resultCode: string;
    resultMessage: string;
    resultInfo?: DopaResultInfo; // DOPA spec page 1 shows this is optional if resultCode is not 200
}

/**
 * Main response structure from the verifyDopaPOPstatus APIGEE endpoint.
 */
export interface VerifyDopaPOPStatusApiResponse {
    resultResponse: DopaResultResponse;
}

/**
 * Internal standardized result after processing the DOPA API call.
 */
export interface VerifyDopaInternalResult {
    status: VerificationStatus; // Use the new VerificationStatus type
    dopaResponse?: DopaResultInfo; // Store the original DOPA info for logging/debugging
    errorMessage?: string;
}

/**
 * Parameters for the service method performing DOPA POP status verification.
 */
export interface PerformDopaPopStatusVerificationParams {
    correlatorId: string;
    mobileNumber?: string; // Encrypted mobile number from BFF/frontend (will be decrypted before use if needed)
    idNumber: string;     // From certificationId (will be decrypted before use)
    dateOfBirth: string;  // From dateOfBirth (will be decrypted and formatted to DDMMYYYY for the API)
    journey: CART_JOURNEYS;
}