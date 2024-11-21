// src/routes/cart.route.ts

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { CartController } from '../controllers/cart.controller';
import { authenticate } from '../middleware/authenticate';
import { CartItemController } from '../controllers/cart-item.controller';

const cartRouter = Router();
const authController = new AuthController();
const cartController = new CartController();
const cartItemController = new CartItemController();

cartRouter.post('/auth/anonymous', authController.createAnonymousSession);
cartRouter.post('/auth/anonymous/renew', authController.renewAnonymousSession);

cartRouter.post('/carts/anonymous', authenticate, cartController.createAnonymousCart);
cartRouter.get('/carts/:id/', authenticate, cartController.getCartById);
cartRouter.post('/carts/:id/items', authenticate, cartItemController.addItem);

export default cartRouter;