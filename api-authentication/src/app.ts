import express, { Application } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import * as OpenApiValidator from 'express-openapi-validator';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createAuthMiddleware } from './middleware/authMiddleware';
import {
  configureHelmet,
  createCorsMiddleware,
  createOpenApiRateLimiter,
  requestLogger,
} from './middleware/security';
import { JwtAuthProvider } from './auth/providers/jwtAuth';
import logger from './utils/logger';
import { resolveOpenApiPath } from './utils/paths';

export function createApp(): Application {
  const app = express();

  // Serve OpenAPI spec path (used by rate limiter and validator)
  const apiSpecPath = resolveOpenApiPath(__dirname);

  // Security middleware
  app.use(configureHelmet()); // Security headers
  app.use(createCorsMiddleware()); // Dynamic CORS
  app.use(createOpenApiRateLimiter(apiSpecPath)); // OpenAPI-aware rate limiting
  app.use(requestLogger); // HTTP request logging

  // Cookie parsing middleware (for refresh tokens)
  app.use(cookieParser());

  // Body parsing middleware with size limits
  const bodySizeLimit = process.env.REQUEST_BODY_SIZE_LIMIT || '10mb';
  app.use(express.json({ limit: bodySizeLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodySizeLimit }));

  // JWT authentication provider
  const authProvider = new JwtAuthProvider();
  logger.info('Using JWT authentication');

  // Apply authentication middleware BEFORE OpenAPI validator
  app.use(createAuthMiddleware(authProvider));

  // Controller handlers path
  const operationHandlersPath = path.join(__dirname, 'controllers');

  // OpenAPI validator middleware with automatic operation handlers
  // When operationHandlers is a string path, it looks for files named after the operationId
  // validateSecurity: false disables built-in security validation (we handle auth with custom middleware)
  app.use(
    OpenApiValidator.middleware({
      apiSpec: apiSpecPath,
      validateRequests: true,
      validateResponses: false, // Set to true in development if you want response validation
      validateSecurity: false, // Disable built-in security validation
      operationHandlers: operationHandlersPath,
    })
  );

  // 404 handler for unknown routes
  app.use(notFoundHandler);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}
