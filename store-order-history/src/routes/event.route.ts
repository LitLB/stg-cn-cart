import { Router } from 'express';
import { storeOrderHistoryController } from '../controllers/event.controller';


const eventRouter: Router = Router();

eventRouter.post('/', storeOrderHistoryController);

export default eventRouter;
