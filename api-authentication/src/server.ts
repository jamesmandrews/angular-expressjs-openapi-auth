import 'dotenv/config';
import path from 'path';
import { Server } from 'http';
import { createApp } from './app';
import logger from './utils/logger';
import { testConnection, closePool } from './db/connection';
import { initializeDatabase } from './db/schema';
import { pluginManager } from './plugin-system';

const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000');

let server: Server;

async function startServer() {
  // Test database connection and initialize schema
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  await initializeDatabase();

  // Load plugins from the plugins directory
  const pluginsDir = path.join(__dirname, 'plugins');
  await pluginManager.loadPlugins(pluginsDir);

  const app = createApp();

  server = app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
    logger.info(`API endpoints available at http://localhost:${PORT}/api/v1`);
    logger.info(`Health check available at http://localhost:${PORT}/api/v1/health`);
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server', { error: error.message });
  process.exit(1);
});

/**
 * Graceful shutdown handler
 * Closes server and allows existing connections to complete
 */
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed.');
    await closePool();
    logger.info('Database pool closed. All connections completed.');
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
