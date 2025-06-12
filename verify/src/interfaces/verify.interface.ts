// verify/src/interfaces/verify.interface.ts

import { CART_JOURNEYS } from "../constants/cart.constant";

// Represents the possible status of a verification step
export type VerificationStatus = 'success' | 'fail' | 'bypass' | 'skip' | 'pending' | null;

// Describes the structure of the 'verifyResult' object
export interface VerifyResult {
    verifyOperatorStatus?: VerificationStatus;
    verifyCustomerAndPackageStatus?: VerificationStatus;
    verifySharePlanStatus?: VerificationStatus;
    verifyBlacklistStatus?: VerificationStatus;
    verifyContractStatus?: VerificationStatus;
    verifyDopaStatus?: VerificationStatus;
    verifyLock3StepStatus?: VerificationStatus; // From headless non-commerce
    verify45DayNonShopStatus?: VerificationStatus; // From headless non-commerce
    verifyThaiId5NumberStatus?: VerificationStatus; // From headless non-commerce
    verifyMaxAllowStatus?: VerificationStatus; // From headless non-commerce
    verifyCheckCrossStatus?: VerificationStatus; // From headless non-commerce
    verify4DScoreStatus?: VerificationStatus; // From headless non-commerce
    verify4DScoreValue?: string | null; // From headless non-commerce (e.g., "Green", "Yellow", "Red")
    totalProductTrue?: string | null; // From headless non-commerce, count of products
}

export enum BLACKLIST_COLORS {
    GREEN = 'Green',
    YELLOW = 'Yellow',
    RED = 'Red',
}

// This is the structure for the 'data' field in the successful API response
export interface CustomerVerificationData {
    totalProduct?: string;
    hasProduct?: string;
    blacklistColor?: BLACKLIST_COLORS; // Represents 4D score color (e.g., "Green", "Yellow", "Red")
    verifyResult: VerifyResult;
    customerProfile: ICustomerProfile
}

// New Interface for Query Parameters 
export interface CustomerVerifyQueryParams {
    journey: CART_JOURNEYS | string; // Allow specific enum or general string
    mobileNumber?: string;          // Encrypted, optional depending on journey/verifyState
    verifyState: string[];

    // Parameters for 'new_device_bundle' journey, DOPA verification
    certificationId: string;       // Encrypted
    dateOfBirth: string;           // Encrypted, expected DDMMYYYY after decryption

    // Parameters for 'new_device_bundle' journey, Headless Non-Commerce (placeholders)
    certificationType?: 'I' | 'P' | 'A' | string; // Thai ID, Passport, Alien or general string
    campaignCode?: string;
    productCode?: string;
    propoId?: string;
}

export interface ICustomerProfile {
    operator?: string;
    companyCode: string;
    birthOfDate: string;
    customerNumber?: string;
    customerType?: string;
    isProductTrue?: string;
    pricePlan?: string;
    packageCode?: string;
    ageOfUse?: string;
}