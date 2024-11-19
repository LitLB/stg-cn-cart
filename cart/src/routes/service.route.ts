// src/routes/service.route.ts

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();
const authController = new AuthController();

router.post('/api/auth/anonymous', authController.createAnonymousSession);
router.post('/api/auth/anonymous/renew', authController.renewAnonymousSession);

export default router;
