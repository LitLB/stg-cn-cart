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
        .exists({ checkFalsy: true })
        .withMessage('journey is required')
        .isString()
        .withMessage('journey must be a string'),

    query('verifyState')
        .exists({ checkFalsy: true })
        .withMessage('verifyState is required')
        .bail()
        .customSanitizer(value => {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') return [value];
            return [];
        }),

    query('verifyState.*')
        .isString()
        .withMessage('verifyState must be a string')
        .notEmpty()
        .withMessage('verifyState must be a non-empty string'),
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
