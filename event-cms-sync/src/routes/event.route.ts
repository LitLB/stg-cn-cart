import { Router } from 'express';
import { eventController } from '../controllers/event.controller';

const eventRouter: Router = Router();

eventRouter.post('/', eventController);

export default eventRouter;