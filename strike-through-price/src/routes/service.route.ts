import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { create, remove } from '../controllers/customer-group.controller';

const serviceRouter = Router();

serviceRouter.post('/', productController);
serviceRouter.post('/customer-group', create);
serviceRouter.delete('/customer-group', remove);

export default serviceRouter;
