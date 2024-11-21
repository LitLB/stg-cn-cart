// cart/src/index.ts

import * as dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import bodyParser from 'body-parser';
import cartRouter from './routes/cart.route';
import { logger } from './utils/logger.utils';
import { readConfiguration } from './utils/config.utils';
import { errorHandler } from './middleware/error-handler.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';

readConfiguration();

const PORT = 8080;

const app: Express = express();

app.disable('x-powered-by');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define routes
app.use('/cart', cartRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// Listen the application
const server = app.listen(PORT, () => {
  logger.info(`⚡️ Service application listening on port ${PORT}`);
});

export default server;