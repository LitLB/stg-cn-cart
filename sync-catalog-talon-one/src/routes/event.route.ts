import { Router } from 'express';
import { syncController } from '../controllers/event.controller';


const eventRouter: Router = Router();

eventRouter.post('/', syncController);

export default eventRouter;
