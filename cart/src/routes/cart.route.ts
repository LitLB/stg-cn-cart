// src/routes/cart.route.ts

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { CartController } from '../controllers/cart.controller';
import { authenticate } from '../middleware/authenticate';
import { CartItemController } from '../controllers/cart-item.controller';
import { BlacklistController } from '../controllers/blacklist.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { cartParamsSchema, createAnonymousCartSchema, getCartQuerySchema } from '../schemas/cart.schema';

const cartRouter = Router();
const authController = new AuthController();
const cartController = new CartController();
const cartItemController = new CartItemController();
const blacklistController = new BlacklistController();

cartRouter.post('/test', authenticate, cartController.test);


cartRouter.post('/v1/oauth/anonymous', authController.createAnonymousSession);
cartRouter.patch('/v1/oauth/anonymous', authController.renewAnonymousSession);

cartRouter.post('/v1/carts', authenticate, validateRequest({ body: createAnonymousCartSchema }), cartController.createAnonymousCart);
cartRouter.get('/v1/carts/:id', authenticate, validateRequest({ params: cartParamsSchema, query: getCartQuerySchema }), cartController.getCartById);
cartRouter.post('/v1/checkout/:id', authenticate, cartController.checkout);

cartRouter.post('/v1/carts/:id/items', authenticate, cartItemController.addItem);
cartRouter.post('/v1/carts/:id/items/select', authenticate, cartItemController.select);
cartRouter.delete('/v1/carts/:id/items/bulk-delete', authenticate, cartItemController.bulkDelete);
cartRouter.put('/v1/carts/:id/items/:itemId', authenticate, cartItemController.updateItemQuantityById);
cartRouter.delete('/v1/carts/:id/items/:itemId', authenticate, cartItemController.deleteItemById);

cartRouter.post('/v1/order/check-blacklist', blacklistController.checkBlacklist);
cartRouter.post('/v1/orders', authenticate, cartController.createOrder);

export default cartRouter;