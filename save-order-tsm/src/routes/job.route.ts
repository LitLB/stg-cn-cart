import { Router } from 'express';
import { saveOrderTSMController } from '../controllers/job.controller';

const jobRouter: Router = Router();

jobRouter.post('/save', saveOrderTSMController);

export default jobRouter;
