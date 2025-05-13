// src/routes/coupon.route.ts

import { Router } from 'express';
import { OtpController } from '../controllers/otp.controller';
import { handleValidationErrors, validateCheckCustomerProfile, validateCheckCustomerTier, validateRequestOtp, validateVerifyOtp } from '../validators/otp.validators';

const otpRouter = Router();
const otpController = new OtpController();

otpRouter.get('/v1/preverify/otp/request', validateRequestOtp, handleValidationErrors, otpController.requestOtp)
otpRouter.get('/v1/preverify/otp/verify', validateVerifyOtp, handleValidationErrors, otpController.verifyOtp)
// otpRouter.get('/v1/preverify/customer/verify', validateCheckCustomerProfile, handleValidationErrors, otpController.handleCustomerVerification)
otpRouter.get('/v1/preverify/customer/verify', otpController.handleCustomerVerification)
otpRouter.get('/v1/package/offer', validateCheckCustomerTier, handleValidationErrors, otpController.getPackageOffer)

export default otpRouter;