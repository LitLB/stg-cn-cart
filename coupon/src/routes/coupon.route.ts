// src/routes/coupon.route.ts

import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { authenticate } from '../middleware/authenticate';

const couponRouter = Router();
const couponController = new CouponController();

couponRouter.get('/v1/coupons', authenticate, couponController.getQueryCoupons);
couponRouter.post('/v1/:id/coupons', authenticate, couponController.applyCoupons);

export default couponRouter;