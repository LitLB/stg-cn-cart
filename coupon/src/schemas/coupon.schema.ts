import Joi from 'joi';

export const getCouponsQuerySchema = Joi.object({
    totalPrice: Joi.number().positive().optional().messages({
        "number.base": `"totalPrice" must be a number`,
        "number.positive": `"totalPrice" must be a positive number`,
    }),

    containsDiscountedProducts: Joi.boolean().truthy("true").falsy("false").optional().messages({
        "boolean.base": `"containsDiscountedProducts" must be true or false`,
    }),
    allowStacking: Joi.boolean().truthy("true").falsy("false").optional().messages({
        "boolean.base": `"allowStacking" must be true or false`,
    }),

    // ✅ Optional but cannot be empty
    campaignGroup: Joi.string().optional().not(null).not("").messages({
        "any.invalid": `"campaignGroup" cannot be empty or null`,
        "string.base": `"campaignGroup" must be a string`,
    }),
    loyalty: Joi.string().optional().not(null).not("").messages({
        "any.invalid": `"loyalty" cannot be empty or null`,
        "string.base": `"loyalty" must be a string`,
    }),
    customerType: Joi.string().optional().not(null).not("").messages({
        "any.invalid": `"customerType" cannot be empty or null`,
        "string.base": `"customerType" must be a string`,
    }),
    journey: Joi.string().optional().not(null).not("").messages({
        "any.invalid": `"journey" cannot be empty or null`,
        "string.base": `"journey" must be a string`,
    }),

    // ✅ Array fields must contain only non-empty strings
    skus: Joi.array().items(Joi.string().min(1).required().messages({
        "string.empty": `"skus" cannot contain empty strings`,
        "any.required": `"skus" must contain valid values`,
    })).optional(),

    series: Joi.array().items(Joi.string().min(1).required().messages({
        "string.empty": `"series" cannot contain empty strings`,
        "any.required": `"series" must contain valid values`,
    })).optional(),

    brands: Joi.array().items(Joi.string().min(1).required().messages({
        "string.empty": `"brands" cannot contain empty strings`,
        "any.required": `"brands" must contain valid values`,
    })).optional(),

    categories: Joi.array().items(Joi.string().min(1).required().messages({
        "string.empty": `"categories" cannot contain empty strings`,
        "any.required": `"categories" must contain valid values`,
    })).optional(),

    packageIds: Joi.array().items(Joi.string().min(1).required().messages({
        "string.empty": `"packageIds" cannot contain empty strings`,
        "any.required": `"packageIds" must contain valid values`,
    })).optional(),
})