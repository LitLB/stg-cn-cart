// src/validators/otp.validators.ts

import { query, header, ValidationChain, validationResult, check } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { CART_JOURNEYS } from '../constants/cart.constant';

export const validateVerifyOtp: ValidationChain[] = [
    query('mobileNumber')
        .exists({ checkFalsy: true })
        .withMessage('mobileNumber is required')
        .isString()
        .withMessage('mobileNumber must be a string'),

    query('refCode')
        .exists({ checkFalsy: true })
        .withMessage('refCode is required')
        .isString()
        .isLength({ min: 6, max: 6 })
        .withMessage('refCode must be a string and correct format'),

    query('pin')
        .exists({ checkFalsy: true })
        .withMessage('pin is required')
        .isString()
        .isLength({ min: 6, max: 6 })
        .withMessage('pin must be a string and length must equal 6 characters'),

    query('journey')
        .exists({ checkFalsy: true })
        .withMessage('journey is required')
        .isString()
        .withMessage('journey must be a string'),
];

export const validateRequestOtp: ValidationChain[] = [
    query('mobileNumber')
        .exists({ checkFalsy: true })
        .withMessage('mobileNumber is required')
        .isString()
        .withMessage('mobileNumber must be a string'),
]

// Modified validateCheckCustomerProfile 
export const validateCheckCustomerProfile: ValidationChain[] = [
    header('correlatorid')
        .exists({ checkFalsy: true }).withMessage('correlatorid header is required')
        .isString().withMessage('correlatorid must be a string'),
    query('journey')
        .exists({ checkFalsy: true }).withMessage('journey is required')
        .isString().withMessage('journey must be a string')
        .isIn(Object.values(CART_JOURNEYS)).withMessage(`Invalid journey value. Must be one of: ${Object.values(CART_JOURNEYS).join(', ')}`),
    query('mobileNumber') // Optional for new_device_bundle unless specific verifyState (like DOPA with MSSIDN) needs it.
        .optional({ checkFalsy: true }) // if present, must be a string
        .isString().withMessage('mobileNumber must be a string if provided'),
    query('verifyState')
        .exists({ checkFalsy: true }).withMessage('verifyState is required')
        .custom((value) => {
            if (typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string'))) {
                return true;
            }
            throw new Error('verifyState must be a string or an array of strings');
        }),

    // Conditional validations based on journey and verifyState
    check().custom((value, { req }) => {
        const { journey, verifyState, certificationId, dateOfBirth, certificationType, campaignCode, productCode, propoId } = req.query;
        
        // Ensure verifyState is an array for easier checking
        const statesToCheck = Array.isArray(verifyState) ? verifyState : (verifyState ? [verifyState] : []);

        if (journey === CART_JOURNEYS.DEVICE_BUNDLE_NEW) {
            if (statesToCheck.includes('dopa')) {
                if (!certificationId) {
                    throw new Error('certificationId (encrypted) is required for DOPA verification in new_device_bundle journey');
                }
                if (typeof certificationId !== 'string') {
                    throw new Error('certificationId must be a string for DOPA');
                }
                if (!dateOfBirth) {
                    throw new Error('dateOfBirth (encrypted, DDMMYYYY) is required for DOPA verification in new_device_bundle journey');
                }
                if (typeof dateOfBirth !== 'string') {
                    throw new Error('dateOfBirth must be a string for DOPA');
                }
            }

            // Placeholder for headless non-commerce params (not in scope for VECOM-4491 minimal change for DOPA)
            // if (statesToCheck.includes('hlPreverFull') || statesToCheck.includes('hl4DScore')) {
            //     if (!certificationId) throw new Error('certificationId is required for headless verification');
            //     if (typeof certificationId !== 'string') throw new Error('certificationId must be a string');
            //     if (!certificationType) throw new Error('certificationType is required for headless verification');
            //     if (typeof certificationType !== 'string' || !['I', 'P', 'A'].includes(certificationType as string)) throw new Error('Invalid certificationType for headless');
            //     if (!dateOfBirth) throw new Error('dateOfBirth is required for headless verification');
            //     if (typeof dateOfBirth !== 'string') throw new Error('dateOfBirth must be a string');
            //     if (!campaignCode) throw new Error('campaignCode is required for headless verification');
            //     if (typeof campaignCode !== 'string') throw new Error('campaignCode must be a string');
            //     if (!productCode) throw new Error('productCode is required for headless verification');
            //     if (typeof productCode !== 'string') throw new Error('productCode must be a string');
            //     if (!propoId) throw new Error('propoId is required for headless verification');
            //     if (typeof propoId !== 'string') throw new Error('propoId must be a string');
            // }
        } else if (journey === CART_JOURNEYS.DEVICE_BUNDLE_EXISTING) {
            // For existing bundle, mobileNumber is usually mandatory for most checks
            if (!req.query.mobileNumber) {
                 throw new Error('mobileNumber (encrypted) is required for device_bundle_existing journey');
            }
            if (typeof req.query.mobileNumber !== 'string') {
                throw new Error('mobileNumber must be a string for device_bundle_existing journey');
            }
        }
        return true;
    }),
];
// End of modified validateCheckCustomerProfile

export const validateCheckCustomerTier: ValidationChain[] = [
    query('mobileNumber')
        .exists({ checkFalsy: true })
        .withMessage('mobileNumber is required')
        .isString()
        .withMessage('mobileNumber must be a string'),

    query('journey')
        .exists({ checkFalsy: true })
        .withMessage('journey is required')
        .isString()
        .withMessage('journey must be a string'),
];

// Middleware to check for errors from express-validator
export const handleValidationErrors = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Log validation errors for debugging
        // logger.error("Validation Errors:", JSON.stringify(errors.array()));
        return res.status(400).json({
            statusCode: "400.1001",
            statusMessage: 'Input parameter is blank or invalid',
            errorCode: 'INPUT_PARAMETER_IS_BLANK_OR_INVALID',
            // errors: errors.array() // Optionally include detailed errors in non-prod environments
        });
    }
    next();
};
