// cart/src/index.ts

import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import express, { Express } from 'express';
import bodyParser from 'body-parser';
import cartRouter from './routes/cart.route';
import { logger } from './utils/logger.utils';
import { readConfiguration } from './utils/config.utils';
import { errorHandler } from './middleware/error-handler.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';

// Load configuration settings early
readConfiguration();

// Import global process error handlers after configuration is loaded
import './core/process-error-handlers.core';

const PORT = 8080;

const app: Express = express();

app.disable('x-powered-by'); // Disable the X-Powered-By header for security

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define application routes
app.use('/cart', cartRouter);

// Handle 404 Not Found errors
app.use(notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

// Start the Express server
const server = app.listen(PORT, () => {
    logger.info(`⚡️ Service application listening on port ${PORT}`);
});

export default server;
