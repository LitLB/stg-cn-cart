// src/routes/cart.route.ts

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { OrderController } from '../controllers/order.controller';

const orderRouter = Router();
const orderController = new OrderController();

orderRouter.get('/v1/orders/:id', authenticate, orderController.getOrderById);

export default orderRouter;