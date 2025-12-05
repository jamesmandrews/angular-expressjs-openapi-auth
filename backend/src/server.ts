import { Server } from 'http';
import { createApp } from './app';
import logger from './utils/logger';

const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000');

const app = createApp();

const server: Server = app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
  logger.info(`API endpoints available at http://localhost:${PORT}/api/v1`);
  logger.info(`Health check available at http://localhost:${PORT}/api/v1/health`);
});

/**
 * Graceful shutdown handler
 * Closes server and allows existing connections to complete
 */
function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed. All connections completed.');
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error(`Shutdown timeout (${SHUTDOWN_TIMEOUT}ms) exceeded. Forcing shutdown.`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  gracefulShutdown('unhandledRejection');
});
