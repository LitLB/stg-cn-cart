// verify/src/interfaces/dopa.interface.ts

import { CART_JOURNEYS } from "../constants/cart.constant";
import { VerificationStatus } from "./verify.interface"; // Import new type

/**
 * Request payload for the verifyDopaPOPstatus OMNI endpoint.
 */
export interface VerifyDopaPOPStatusRequestBody {
    verifyDopaPOPstatus: {
        requestId: string;
        channel: string;
        MSSIDN?: string; // Optional, used for new_device_bundle journey
        idNumber: string;
        dateOfBirth: string; // Format: DDMMYYYY
        timeStamp: Date;
    }
}

/**
 * Main response structure from the verifyDopaPOPstatus OMNI endpoint.
 */
export interface VerifyDopaPOPApiResponse {
    transactionId: string;
    timestamp: string;
    status: string;
    statusReason: string;
    isByPass?: string;
    code?: string
    message?: string;
    description?: string;
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