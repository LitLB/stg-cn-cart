// src/routes/service.route.ts

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
// import { CartController } from '../controllers/cart.controller';

const serviceRouter = Router();
const authController = new AuthController();
// const cartController = new CartController();

serviceRouter.post('/auth/anonymous', authController.createAnonymousSession);
serviceRouter.post('/auth/anonymous/renew', authController.renewAnonymousSession);

// serviceRouter.post('/carts/anonymous', cartController.createAnonymousCart);

export default serviceRouter;
