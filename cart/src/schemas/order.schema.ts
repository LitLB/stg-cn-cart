import Joi from "joi";

export const getOrderTrackingSchema = Joi.object({
    orderNumber: Joi.string().required().messages({
        'string.empty': 'Order Number cannot be empty',
        'any.required': 'Order Number is required',
    })
})