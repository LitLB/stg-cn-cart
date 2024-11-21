// cart/src/index.ts

import * as dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import bodyParser from 'body-parser';

// Import routes
import ServiceRoutes from './routes/service.route';

// Import logger
import { logger } from './utils/logger.utils';

import { readConfiguration } from './utils/config.utils';

// Read env variables
readConfiguration();

const PORT = 8080;

// Create the express app
const app: Express = express();
app.disable('x-powered-by');

// Define configurations
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define routes
app.use('/cart', ServiceRoutes);

// Handle 404 errors - route not found
app.use((req: Request, res: Response, next: NextFunction) => {
  console.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ statusMessage: 'Route not found' });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('An error occurred:', err);
  res.status(err.status || 500).json({
    statusCode: err.status || 500,
    statusMessage: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// Listen the application
const server = app.listen(PORT, () => {
  logger.info(`⚡️ Service application listening on port ${PORT}`);
});

export default server;