// cart/src/schemas/cart.schema.ts

import Joi from 'joi';
import { CART_JOURNEYS } from '../constants/cart.constant';
import { AddItemCartHeadersRequest } from './cart-item.schema';

/**
 * Validation schema for cart route parameters.
 *
 * @returns Joi schema object.
 */
export const cartParamsSchema = Joi.object({
	id: Joi.string().guid({ version: 'uuidv4' }).required().messages({
		'string.guid': 'Cart ID must be a valid UUID',
		'any.required': 'Cart ID is required',
	}),
});

/**
 * Validation schema for querying carts.
 *
 * @returns Joi schema object.
 */
export const getCartQuerySchema = Joi.object({
	selectedOnly: Joi.boolean().optional().messages({
		'boolean.base': 'selectedOnly must be a boolean',
	}),
	includeCoupons: Joi.boolean().optional().messages({
		'boolean.base': 'includeCoupons must be a boolean',
	}),
});

/**
 * Validation schema for creating an anonymous cart.
 *
 * @returns Joi schema object.
 */
export const createAnonymousCartSchema = Joi.object({
	campaignGroup: Joi.string().max(100).required().messages({
		'string.empty': 'Campaign Group cannot be empty',
		'any.required': 'Campaign Group is required',
		'string.max': 'Campaign Group must not exceed 100 characters',
	}),
	journey: Joi.string()
		.valid(CART_JOURNEYS.SINGLE_PRODUCT, CART_JOURNEYS.DEVICE_ONLY, CART_JOURNEYS.DEVICE_BUNDLE_EXISTING, CART_JOURNEYS.DEVICE_BUNDLE_NEW, CART_JOURNEYS.DEVICE_BUNDLE_P2P, CART_JOURNEYS.DEVICE_BUNDLE_MNP_1_STEP)
		.required()
		.messages({
			'string.empty': 'Journey cannot be empty',
			'any.required': 'Journey is required',
			'any.only': `Journey must be one of: ${Object.values(CART_JOURNEYS).join(', ')}`,
		}),
	locale: Joi.string().optional(),
	customerInfo: Joi.any().optional(),
});

export function validateCartCheckoutBody(body: any) {
	return Joi.any().validate(body, { abortEarly: false });
	return Joi.object({
		cartId: Joi.string().uuid().required().messages({
			'string.empty': 'Cart ID cannot be empty',
			'any.required': 'Cart ID is required',
			'string.guid': 'Cart ID must be a valid UUID',
		}),
		shippingAddress: Joi.object({
			firstName: Joi.string().required().messages({
				'string.empty': 'First name cannot be empty',
				'any.required': 'First name is required',
			}),
			lastName: Joi.string().required().messages({
				'string.empty': 'Last name cannot be empty',
				'any.required': 'Last name is required',
			}),
			streetName: Joi.string().required().messages({
				'string.empty': 'Street name cannot be empty',
				'any.required': 'Street name is required',
			}),
			streetNumber: Joi.string().required().messages({
				'string.empty': 'Street number cannot be empty',
				'any.required': 'Street number is required',
			}),
			postalCode: Joi.string().required().messages({
				'string.empty': 'Postal code cannot be empty',
				'any.required': 'Postal code is required',
			}),
			city: Joi.string().required().messages({
				'string.empty': 'City cannot be empty',
				'any.required': 'City is required',
			}),
			country: Joi.string().length(2).required().messages({
				'string.empty': 'Country cannot be empty',
				'any.required': 'Country is required',
				'string.length': 'Country must be a valid 2-letter code',
			}),
			phone: Joi.string()
				.optional()
				.allow(null, '')
				.pattern(/^0\d{8,9}$/)
				.messages({
					'string.pattern.base': 'Phone number must be a valid Thai phone number (e.g., 0812345678)',
				}),
		}).required().messages({
			'any.required': 'Shipping address is required',
		}),
		billingAddress: Joi.object({
			firstName: Joi.string().required().messages({
				'string.empty': 'First name cannot be empty',
				'any.required': 'First name is required',
			}),
			lastName: Joi.string().required().messages({
				'string.empty': 'Last name cannot be empty',
				'any.required': 'Last name is required',
			}),
			streetName: Joi.string().required().messages({
				'string.empty': 'Street name cannot be empty',
				'any.required': 'Street name is required',
			}),
			streetNumber: Joi.string().required().messages({
				'string.empty': 'Street number cannot be empty',
				'any.required': 'Street number is required',
			}),
			postalCode: Joi.string().required().messages({
				'string.empty': 'Postal code cannot be empty',
				'any.required': 'Postal code is required',
			}),
			city: Joi.string().required().messages({
				'string.empty': 'City cannot be empty',
				'any.required': 'City is required',
			}),
			country: Joi.string().length(2).required().messages({
				'string.empty': 'Country cannot be empty',
				'any.required': 'Country is required',
				'string.length': 'Country must be a valid 2-letter code',
			}),
			phone: Joi.string()
				.optional()
				.allow(null, '')
				.pattern(/^0\d{8,9}$/)
				.messages({
					'string.pattern.base': 'Phone number must be a valid Thai phone number (e.g., 0812345678)',
				}),
		}).required().messages({
			'any.required': 'Billing address is required',
		}),
		shippingMethodId: Joi.string().uuid().required().messages({
			'string.empty': 'Shipping method ID cannot be empty',
			'any.required': 'Shipping method ID is required',
			'string.guid': 'Shipping method ID must be a valid UUID',
		}),
		paymentMethod: Joi.object({
			type: Joi.string().valid('credit_card', 'paypal', 'bank_transfer').required().messages({
				'any.only': 'Payment type must be one of credit_card, paypal, bank_transfer',
				'any.required': 'Payment type is required',
			}),
			details: Joi.object({
				cardNumber: Joi.string().creditCard().required().messages({
					'string.empty': 'Card number cannot be empty',
					'string.creditCard': 'Card number must be a valid credit card',
					'any.required': 'Card number is required',
				}),
				expiryMonth: Joi.string().pattern(/^(0[1-9]|1[0-2])$/).required().messages({
					'string.empty': 'Expiry month cannot be empty',
					'string.pattern.base': 'Expiry month must be in MM format',
					'any.required': 'Expiry month is required',
				}),
				expiryYear: Joi.string().pattern(/^\d{4}$/).required().messages({
					'string.empty': 'Expiry year cannot be empty',
					'string.pattern.base': 'Expiry year must be in YYYY format',
					'any.required': 'Expiry year is required',
				}),
				cvv: Joi.string().pattern(/^\d{3,4}$/).required().messages({
					'string.empty': 'CVV cannot be empty',
					'string.pattern.base': 'CVV must be 3 or 4 digits',
					'any.required': 'CVV is required',
				}),
				cardHolderName: Joi.string().required().messages({
					'string.empty': 'Card holder name cannot be empty',
					'any.required': 'Card holder name is required',
				}),
			}).required().messages({
				'any.required': 'Payment details are required',
			}),
		}).required().messages({
			'any.required': 'Payment method is required',
		}),
	}).validate(body, { abortEarly: false });
}

export type CreateCartHeadersRequest = {
    'content-type': string;
    authorization: string;
    correlatorid: string;
}

export function validateCreateCartHeaders(headers: any) {
    return Joi.object<CreateCartHeadersRequest>({
        'content-type': Joi.string().required(),
        authorization: Joi.string().required(),
        correlatorid: Joi.string().required(),
    }).validate(headers, { abortEarly: false, allowUnknown: true });
}
