// cart/src/core/process-error-handlers.core.ts

import server from '..';
import { readConfiguration } from '../utils/config.utils';
import { logger } from '../utils/logger.utils';

/**
 * Gracefully shuts down the application.
 * Closes the server and exits the process.
 */
const gracefulShutdown = () => {
    logger.info('Initiating graceful shutdown...');

    server.close(() => {
        logger.info('Closed out remaining connections.');
        process.exit(1);
    });

    // Force shutdown after a timeout if graceful shutdown takes too long
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
};

/**
 * Handles uncaught exceptions that are not caught by any try/catch block.
 * Logs the error and conditionally shuts down the application based on configuration.
 *
 * @param error - The uncaught exception object.
 */
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);

    const config = readConfiguration();

    if (config.shutdownOnFatalError === 'true') {
        logger.info('Shutting down due to uncaught exception.');
        gracefulShutdown();
    } else {
        logger.warn('Application continues to run despite uncaught exception.');
    }
});

/**
 * Handles unhandled promise rejections that are not caught by any .catch() handler.
 * Logs the reason and conditionally shuts down the application based on configuration.
 *
 * @param reason - The reason why the promise was rejected.
 * @param promise - The promise that was rejected.
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);

    const config = readConfiguration();

    if (config.shutdownOnFatalError === 'true') {
        logger.info('Shutting down due to unhandled promise rejection.');
        gracefulShutdown();
    } else {
        logger.warn('Application continues to run despite unhandled promise rejection.');
    }
});
