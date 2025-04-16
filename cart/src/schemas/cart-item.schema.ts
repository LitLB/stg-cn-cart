// cart/src/schemas/cart-item.schema.ts

import type { Attribute, Cart, LineItem, ProductVariant } from '@commercetools/platform-sdk';
import Joi from 'joi';
import { getAttributeValue } from '../utils/product-utils';
import { HTTP_STATUSES } from '../constants/http.constant';
import { CART_OPERATOS } from '../constants/cart.constant';
import * as _ from 'lodash'

export function validateSelectCartItemBody(body: any) {
	return Joi.object({
		items: Joi.array()
			.items(
				Joi.object({
					productId: Joi.string().required().messages({
						'string.empty': 'Product ID cannot be empty',
						'any.required': 'Product ID is required',
					}),
					sku: Joi.string().required().messages({
						'string.empty': 'SKU cannot be empty',
						'any.required': 'SKU is required',
					}),
					productType: Joi.string()
						.valid('main_product', 'add_on', 'insurance', 'free_gift')
						.required()
						.messages({
							'string.base': 'Product Type must be a string',
							'any.only': 'Product Type must be "main_product", "add_on", or "insurance"',
							'any.required': 'Product Type is required',
						}),
					productGroup: Joi.number()
						.integer()
						.required()
						.messages({
							'number.base': 'Product Group must be a number',
							'number.integer': 'Product Group must be an integer',
							'any.required': 'Product Group is required',
						}),
					addOnGroup: Joi.string()
						.allow(null, '')
						.when('productType', {
							is: 'add_on',
							then: Joi.required().messages({
								'any.required': 'Add On Group is required when Product Type is "add_on"'
							})
						})
						.messages({
							'string.base': 'Add On Group must be a string',
						}),
					freeGiftGroup: Joi.string()
						.allow(null, '')
						.when('productType', {
							is: 'free_gift',
							then: Joi.required().messages({
								'any.required': 'Free Gift Group is required when Product Type is "free_gift"'
							})
						})
						.messages({
							'string.base': 'Free Gift Group must be a string',
						}),
					selected: Joi.boolean().required().messages({
						'any.required': 'Selected field is required.',
						'boolean.base': 'Selected field must be a boolean.',
						}),
					package: Joi.object({
						code: Joi.string().required().messages({
							'string.empty': 'Package Code cannot be empty',
							'any.required': 'Product Code is required',
						}),
					}).optional(),
					sim: Joi.object({
						sku: Joi.string().required().messages({
							'string.empty': 'SIM SKU cannot be empty',
							'any.required': 'SIM SKU is required',
						}),
					}).optional()
				}),
			)
			.min(1)
			.required()
			.messages({
				'array.min': 'At least one item must be provided',
				'any.required': 'Items array is required',
			}),
	}).validate(body, { abortEarly: false });
}

export type AddItemCartBodyRequest = {
	productId: string;
	sku: string;
	quantity: number;
	campaignGroup?: string | null;
	journey?: string | null;
	loyaltyTier?: string | null;
	campaignByJourney?: string | null;
	propositionGroup?: string | null;
	productType: 'main_product' | 'add_on' | 'insurance' | 'free_gift';
	productGroup?: number;
	addOnGroup?: string | null;
	freeGiftGroup?: string | null;
	campaignVerifyValues?: {
		name: string;
		value: any;
	}[];
	operator: 'TRUE' | 'DTAC';
	package?: {
		code: string;
	};
	sim?: {
		sku: string;
	};
};
  
export function validateAddItemCartBody(body: any) {
	return Joi.object<AddItemCartBodyRequest>({
		productId: Joi.string().required().messages({
			'string.empty': 'Product ID cannot be empty',
			'any.required': 'Product ID is required',
		}),
		sku: Joi.string().required().messages({
			'string.empty': 'SKU cannot be empty',
			'any.required': 'SKU is required',
		}),
		quantity: Joi.number().integer().positive().required().messages({
			'number.base': 'Quantity must be a number',
			'number.integer': 'Quantity must be an integer',
			'number.positive': 'Quantity must be positive',
			'any.required': 'Quantity is required',
		}),
		campaignGroup: Joi.string().optional().allow(null, ''),
		journey: Joi.string().optional().allow(null, ''),
		loyaltyTier: Joi.string().optional().allow(null, ''),
		campaignByJourney: Joi.string().optional().allow(null, ''),
		propositionGroup: Joi.string().optional().allow(null, ''),
		productType: Joi.string()
			.valid('main_product', 'add_on', 'insurance', 'free_gift') // TODO: Free Gift changes
			.required()
			.messages({
				'string.base': 'Product Type must be a string',
				'any.only': 'Product Type must be "main_product", "add_on", "insurance", or "free_gift"',
				'any.required': 'Product Type is required',
			}),
		productGroup: Joi.number()
			.integer()
			.when('productType', {
				is: Joi.valid('add_on', 'insurance'),
				then: Joi.required().messages({
					'any.required': 'Product Group is required when Product Type is "add_on" or "insurance"'
				})
			})
			.messages({
				'number.base': 'Product Group must be a number',
				'number.integer': 'Product Group must be an integer',
				'any.required': 'Product Group is required',
			}),
		addOnGroup: Joi.string()
			.allow(null, '')
			.when('productType', {
				is: 'add_on',
				then: Joi.required().messages({
					'any.required': 'Add On Group is required when Product Type is "add_on"'
				})
			})
			.messages({
				'string.base': 'Add On Group must be a string',
			}),
		freeGiftGroup: Joi.string()
			.allow(null, '')
			.when('productType', {
				is: 'free_gift',
				then: Joi.required().messages({
					'any.required': 'Free Gift Group is required when Product Type is "free_gift"'
				})
			})
			.messages({
				'string.base': 'Free Gift Group must be a string',
			}),
		campaignVerifyValues: Joi.array()
			.items(
				Joi.object({
					name: Joi.string().required(),
					value: Joi.required()
				})
			)
			.optional(),
		operator : Joi.string()
			.valid(CART_OPERATOS.TRUE, CART_OPERATOS.DTAC)
			.required()
			.messages({
				'string.base': 'operator must be a string',
				'any.only': 'operator must be "TRUE" or "DTAC"',
				'any.required': 'operator is required',
		}),
		package: Joi.object({
			code: Joi.string().required().messages({
				'string.empty': 'Package Code cannot be empty',
				'any.required': 'Product Code is required',
			}),
		}).optional(),
		sim: Joi.object({
			sku: Joi.string().required().messages({
				'string.empty': 'SIM SKU cannot be empty',
				'any.required': 'SIM SKU is required',
			}),
		}).optional()
	}).validate(body, { abortEarly: false });
}

export function validateUpdateCartItemBody(body: any) {
	return Joi.object({
		productId: Joi.string().required().messages({
			'string.empty': 'Product ID cannot be empty',
			'any.required': 'Product ID is required',
		}),
		sku: Joi.string().required().messages({
			'string.empty': 'SKU cannot be empty',
			'any.required': 'SKU is required',
		}),
		quantity: Joi.number().integer().min(0).required().messages({
			'number.base': 'Quantity must be a number',
			'number.integer': 'Quantity must be an integer',
			'number.min': 'Quantity cannot be negative',
			'any.required': 'Quantity is required',
		}),
		productType: Joi.string()
			.valid('main_product', 'add_on', 'insurance', 'free_gift') // TODO: Free Gift changes
			.required()
			.messages({
				'string.base': 'Product Type must be a string',
				'any.only': 'Product Type must be "main_product", "add_on", or "insurance"',
				'any.required': 'Product Type is required',
			}),
		productGroup: Joi.number()
			.integer()
			.required()
			.messages({
				'number.base': 'Product Group must be a number',
				'number.integer': 'Product Group must be an integer',
				'any.required': 'Product Group is required',
			}),
		addOnGroup: Joi.string()
			.allow(null, '')
			.when('productType', {
				is: 'add_on',
				then: Joi.required().messages({
					'any.required': 'Add On Group is required when Product Type is "add_on"'
				})
			})
			.messages({
				'string.base': 'Add On Group must be a string',
			}),
		freeGiftGroup: Joi.string()
			.allow(null, '')
			.when('productType', {
				is: 'free_gift',
				then: Joi.required().messages({
					'any.required': 'Free Gift Group is required when Product Type is "free_gift"'
				})
			})
			.messages({
				'string.base': 'Free Gift Group must be a string',
			}),
		package: Joi.object({
			code: Joi.string().required().messages({
				'string.empty': 'Package Code cannot be empty',
				'any.required': 'Product Code is required',
			}),
		}).optional(),
		sim: Joi.object({
			sku: Joi.string().required().messages({
				'string.empty': 'SIM SKU cannot be empty',
				'any.required': 'SIM SKU is required',
			}),
		}).optional()
	}).validate(body, { abortEarly: false });
}

export function validateDeleteCartItemBody(body: any) {
	return Joi.object({
		productId: Joi.string().required().messages({
			'string.empty': 'Product ID cannot be empty',
			'any.required': 'Product ID is required',
		}),
		sku: Joi.string().required().messages({
			'string.empty': 'SKU cannot be empty',
			'any.required': 'SKU is required',
		}),
		productType: Joi.string()
			.valid('main_product', 'add_on', 'insurance', 'free_gift') // TODO: Free Gift changes
			.required()
			.messages({
				'string.base': 'Product Type must be a string',
				'any.only': 'Product Type must be "main_product", "add_on", or "insurance"',
				'any.required': 'Product Type is required',
			}),
		productGroup: Joi.number()
			.integer()
			.required()
			.messages({
				'number.base': 'Product Group must be a number',
				'number.integer': 'Product Group must be an integer',
				'any.required': 'Product Group is required',
			}),
		addOnGroup: Joi.string()
			.allow(null, '')
			.when('productType', {
				is: 'add_on',
				then: Joi.required().messages({
					'any.required': 'Add On Group is required when Product Type is "add_on"'
				})
			})
			.messages({
				'string.base': 'Add On Group must be a string',
			}),
		freeGiftGroup: Joi.string()
			.allow(null, '')
			.when('productType', {
				is: 'free_gift',
				then: Joi.required().messages({
					'any.required': 'Free Gift Group is required when Product Type is "free_gift"'
				})
			})
			.messages({
				'string.base': 'Free Gift Group must be a string',
			}),
	}).validate(body, { abortEarly: false });
}

export function validateBulkDeleteCartItemBody(body: any) {
	return Joi.object({
		items: Joi.array()
			.items(
				Joi.object({
					productId: Joi.string().required().messages({
						'string.empty': 'Product ID cannot be empty',
						'any.required': 'Product ID is required',
					}),
					sku: Joi.string().required().messages({
						'string.empty': 'SKU cannot be empty',
						'any.required': 'SKU is required',
					}),
					productType: Joi.string()
						.valid('main_product', 'add_on', 'insurance', 'free_gift') // TODO: Free Gift changes
						.required()
						.messages({
							'string.base': 'Product Type must be a string',
							'any.only': 'Product Type must be "main_product", "add_on", or "insurance"',
							'any.required': 'Product Type is required',
						}),
					productGroup: Joi.number()
						.integer()
						.required()
						.messages({
							'number.base': 'Product Group must be a number',
							'number.integer': 'Product Group must be an integer',
							'any.required': 'Product Group is required',
						}),
					addOnGroup: Joi.string()
						.allow(null, '')
						.when('productType', {
							is: 'add_on',
							then: Joi.required().messages({
								'any.required': 'Add On Group is required when Product Type is "add_on"'
							})
						})
						.messages({
							'string.base': 'Add On Group must be a string',
						}),
					freeGiftGroup: Joi.string()
						.allow(null, '')
						.when('productType', {
							is: 'free_gift',
							then: Joi.required().messages({
								'any.required': 'Free Gift Group is required when Product Type is "free_gift"'
							})
						})
						.messages({
							'string.base': 'Free Gift Group must be a string',
						}),
				}),
			)
			.min(1)
			.required()
			.messages({
				'array.base': 'Items must be an array',
				'array.min': 'At least one item must be specified for removal',
				'any.required': 'Items are required for bulk deletion',
			}),
	}).validate(body, { abortEarly: false });
}

export function validateProductQuantity(
	productType: string,
	cart: Cart,
	sku: string,
	productId: string,
	variant: ProductVariant,
	deltaQuantity = 0,
): void {
	if (productType !== 'main_product') {
		return;
	}

	// Filter line items with productType 'main_product'
	const mainProductLineItems = cart.lineItems.filter(
		(item: LineItem) => item.custom?.fields?.productType === 'main_product',
	);

	// Existing quantities
	const existingSkuQuantity = mainProductLineItems
		.filter((item: LineItem) => item.variant.sku === sku)
		.reduce((sum, item) => sum + item.quantity, 0);

	const existingProductQuantity = mainProductLineItems
		.filter((item: LineItem) => item.productId === productId)
		.reduce((sum, item) => sum + item.quantity, 0);

	const totalCartQuantity = mainProductLineItems.reduce((sum, item) => sum + item.quantity, 0);

	// Calculate new quantities
	const newSkuQuantity = existingSkuQuantity + deltaQuantity;
	const newProductQuantity = existingProductQuantity + deltaQuantity;
	const newTotalCartQuantity = totalCartQuantity + deltaQuantity;

	// SKU Level Limits from Variant Attributes
	const attributes = variant.attributes || [];
	const skuQuantityMin = getAttributeValue(attributes, 'sku_quantity_min') ?? 1;
	const skuQuantityMax = getAttributeValue(attributes, 'sku_quantity_max');

	// Product Level Limits from Variant Attributes
	const quantityMin = getAttributeValue(attributes, 'quantity_min') ?? 1;
	const quantityMax = getAttributeValue(attributes, 'quantity_max');

	// Negative Quantity Checks
	if (newSkuQuantity < 0) {
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
			statusMessage: `Cannot have less than 0 units of SKU ${sku} in the cart.`,
		};
	}

	if (newProductQuantity < 0) {
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
			statusMessage: `Cannot have less than 0 units of product ${productId} in the cart.`,
		};
	}

	if (newTotalCartQuantity < 0) {
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
			statusMessage: `Cannot have less than 0 units in the cart.`,
		};
	}

	// SKU Level Validations
	if (newSkuQuantity < skuQuantityMin) {
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
			statusMessage: `Cannot have less than ${skuQuantityMin} units of SKU ${sku} in the cart.`,
		};
	}

	if (skuQuantityMax !== null && skuQuantityMax !== undefined && newSkuQuantity > skuQuantityMax) {
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
			statusMessage: `Cannot have more than ${skuQuantityMax} units of SKU ${sku} in the cart.`,
		};
	}

	// Product Level Validations
	if (newProductQuantity < quantityMin) {
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
			statusMessage: `Cannot have less than ${quantityMin} units of product ${productId} in the cart.`,
		};
	}

	if (quantityMax !== null && quantityMax !== undefined && newProductQuantity > quantityMax) {
		throw {
			statusCode: HTTP_STATUSES.BAD_REQUEST,
			statusMessage: `Cannot have more than ${quantityMax} units of product ${productId} in the cart.`,
		};
	}

}

export const validateJourneyCompatibility = (
	cartJourney: string | undefined,
	variantJourney: string | undefined
): void => {
	if (cartJourney === 'device_only') {
		if (variantJourney !== 'device_only') {
			throw {
				statusCode: HTTP_STATUSES.BAD_REQUEST,
				statusMessage: 'Cannot add a non-"device_only" item to a "device_only" cart.'
			}
		}
	}
};

export const validateProductReleaseDate = (variant: any, today: Date): boolean => {


	const releaseDate = getAttributeValue(variant, 'release_start_date')
	const endDate = getAttributeValue(variant, 'release_end_date')

	if (!releaseDate && !endDate) {
		return true;
	}

	const validForm = new Date(releaseDate) <= today
	const validTo = new Date(endDate) >= today

	let isValidPeriod = true


	if (releaseDate && endDate) {
		isValidPeriod = validForm && validTo
	} else if (releaseDate && !endDate) {
		isValidPeriod = validForm
	} else if (!releaseDate && endDate) {
		isValidPeriod = validTo
	}

	return isValidPeriod
}

export const validateSkuStatus = (attributes: Attribute[]) => {

	const skuStatus = getAttributeValue(attributes, 'status')
	if (skuStatus.key !== 'enabled') {
		throw {
			statusCode: HTTP_STATUSES.NOT_FOUND,
			statusMessage: 'Product is unavailable.',
		};
	}
}