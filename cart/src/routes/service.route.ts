// src/routes/service.route.ts

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const serviceRouter = Router();
const authController = new AuthController();

serviceRouter.post('/api/auth/anonymous', authController.createAnonymousSession);
serviceRouter.post('/api/auth/anonymous/renew', authController.renewAnonymousSession);

export default serviceRouter;
