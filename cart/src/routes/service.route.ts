// src/routes/service.route.ts

import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { createAnonymousSession } from '../controllers/auth.controller';
import { create, remove, test } from '../controllers/customer-group.controller';

const serviceRouter = Router();

serviceRouter.get('/v1/test', test);
serviceRouter.post('/v1/anonymous', createAnonymousSession);

export default serviceRouter;
