// File: src/interfaces/verify.interface.ts (or add to otp.interface.ts if preferred)

import { CART_JOURNEYS } from "../constants/cart.constant";

export type VerificationStatus = 'success' | 'fail' | 'bypass' | 'skip' | 'pending' | null;

export interface INewDeviceBundleVerifyResult {
    verifyDopaStatus: VerificationStatus;
    verifyLock3StepStatus: VerificationStatus;
    verify45DayNonShopStatus: VerificationStatus;
    verifyThaiId5NumberStatus: VerificationStatus;
    verifyMaxAllowStatus: VerificationStatus;
    verifyCheckCrossStatus: VerificationStatus;
    verify4DScoreStatus: VerificationStatus;
    verify4DScoreValue: string | null;
    totalProductTrue: string | null;
    verifyOperatorStatus?: VerificationStatus;
    verifyCustomerAndPackageStatus?: VerificationStatus;
    verifySharePlanStatus?: VerificationStatus;
    verifyBlacklistStatus?: VerificationStatus;
    verifyContractStatus?: VerificationStatus;
}

// New Interface for Query Parameters 
export interface CustomerVerifyQueryParams {
    journey: CART_JOURNEYS | string; // Allow specific enum or general string
    mobileNumber?: string;          // Encrypted, optional depending on journey/verifyState
    verifyState: string | string[]; // Can be a single state or multiple

    // Parameters for 'new_device_bundle' journey, DOPA verification
    certificationId?: string;       // Encrypted
    dateOfBirth?: string;           // Encrypted, expected DDMMYYYY after decryption

    // Parameters for 'new_device_bundle' journey, Headless Non-Commerce (placeholders)
    certificationType?: 'I' | 'P' | 'A' | string; // Thai ID, Passport, Alien or general string
    campaignCode?: string;
    productCode?: string;
    propoId?: string;

    // Add any other potential query parameters that might be sent for this endpoint
    // Example:
    // someOtherParam?: string;
}