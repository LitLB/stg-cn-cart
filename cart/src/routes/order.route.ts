// src/routes/cart.route.ts

import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate } from '../middleware/authenticate';
import { validateRequest } from '../middleware/validate.middleware';
import { getOrderTrackingQuerySchema, getOrderTrackingParamsSchema } from '../schemas/order.schema';

const orderRouter = Router();
const orderController = new OrderController();

orderRouter.get('/v1/orders/:id', orderController.getOrderById);
orderRouter.post('/v1/orders/:orderId/tnc', orderController.setTncOrder);

orderRouter.get('/v1/tracking/:orderNumber', authenticate, validateRequest({ params: getOrderTrackingParamsSchema, query: getOrderTrackingQuerySchema }), orderController.getOrderTracking);

export default orderRouter;