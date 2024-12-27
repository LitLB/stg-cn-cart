// src/routes/cart.route.ts

import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';

const orderRouter = Router();
const orderController = new OrderController();

orderRouter.get('/v1/orders/:id', orderController.getOrderById);
orderRouter.post('/v1/orders/:orderId/tnc', orderController.setTncOrder);

export default orderRouter;