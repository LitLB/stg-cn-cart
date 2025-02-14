// src/routes/coupon.route.ts

import { Router } from 'express';
import { OtpController } from '../controllers/otp.controller';

const otpRouter = Router();
const otpController = new OtpController();


otpRouter.get('/v1/preverify/otp/request', otpController.requestOtp)
otpRouter.get('/v1/preverify/otp/verify', otpController.verifyOtp)


export default otpRouter;