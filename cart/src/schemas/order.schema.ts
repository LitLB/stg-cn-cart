import Joi from "joi";

export const getOrderTrackingParamsSchema = Joi.object({
    orderNumber: Joi.string().required().messages({
        'string.empty': 'Order Number cannot be empty',
        'any.required': 'Order Number is required',
    })
})

export const getOrderTrackingQuerySchema = Joi.object({
    sort: Joi.string().valid('asc', 'desc')
        .insensitive()
        .default('desc')
        .optional()
        .messages({
            'string.base': 'sort must be a string',
            'any.only': 'sort must be "asc" or "desc"',
        })
})