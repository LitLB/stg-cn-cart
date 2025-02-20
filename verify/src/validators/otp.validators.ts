import { query, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

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

// Middleware to check for errors from express-validator
export const handleValidationErrors = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            statusCode: "400",
            statusMessage: 'Bad Request',
            errorCode: 'INVALID_INPUT_DATA',
            data: errors.array(),
        });
    }
    next();
};