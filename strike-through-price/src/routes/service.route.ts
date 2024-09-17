import { Router } from 'express';
import { productController } from '../controllers/product.controller';

const serviceRouter = Router();

serviceRouter.post('/', productController);

export default serviceRouter;
