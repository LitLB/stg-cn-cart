// src/routes/coupon.route.ts

import { Router } from 'express';
import { OtpController } from '../controllers/otp.controller';
import { handleValidationErrors, validateCheckCustomerProfile, validateRequestOtp, validateVerifyOtp } from '../validators/otp.validators';

const otpRouter = Router();
const otpController = new OtpController();

otpRouter.get('/v1/preverify/otp/request', validateRequestOtp, handleValidationErrors, otpController.requestOtp)
otpRouter.get('/v1/preverify/otp/verify', validateVerifyOtp, handleValidationErrors, otpController.verifyOtp)
otpRouter.get('/v1/preverify/customer/verify', validateCheckCustomerProfile, handleValidationErrors, otpController.getCustomerProfile)


export default otpRouter;