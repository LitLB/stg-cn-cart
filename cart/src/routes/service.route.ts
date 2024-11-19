// src/routes/service.route.ts

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { CartController } from '../controllers/cart.controller';
import { authenticate } from '../middleware/authenticate';

const serviceRouter = Router();
const authController = new AuthController();
const cartController = new CartController();

serviceRouter.post('/auth/anonymous', authenticate, authController.createAnonymousSession);
serviceRouter.post('/auth/anonymous/renew', authenticate, authController.renewAnonymousSession);

serviceRouter.post('/carts/anonymous', authenticate, cartController.createAnonymousCart);

export default serviceRouter;
