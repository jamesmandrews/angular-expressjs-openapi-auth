import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import logger from '../utils/logger';
import { resolveOpenApiPath } from '../utils/paths';

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

interface OpenApiOperation {
  'x-rate-limit'?: RateLimitConfig;
  [key: string]: unknown;
}

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
  [key: string]: unknown;
}

interface OpenApiSpec {
  paths: Record<string, OpenApiPathItem>;
  [key: string]: unknown;
}

/**
 * Configure dynamic CORS to allow multiple origins
 * Checks if incoming origin is in the allowed list
 */
export function createCorsMiddleware() {
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:4200'];

  logger.info(`CORS configured for origins: ${allowedOrigins.join(', ')}`);

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        // Origin is allowed - return the specific origin in the header
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies to be sent
    optionsSuccessStatus: 200, // For legacy browser support
  });
}

/**
 * Configure Helmet for security headers
 */
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  });
}

/**
 * Configure rate limiting
 * Prevents brute force attacks and API abuse
 */
export function createRateLimiter() {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes default
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'); // 100 requests default

  logger.info(`Rate limiting: ${maxRequests} requests per ${windowMs / 1000}s window`);

  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
      },
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.',
        },
      });
    },
  });
}

/**
 * OpenAPI-aware rate limiting middleware
 * Reads x-rate-limit extensions from OpenAPI spec and applies endpoint-specific limits
 * Falls back to global rate limiter for endpoints without specific limits
 */
export function createOpenApiRateLimiter(apiSpecPath?: string) {
  const specPath = apiSpecPath || resolveOpenApiPath(__dirname);

  // Parse OpenAPI spec
  let spec: OpenApiSpec;
  try {
    const specContent = fs.readFileSync(specPath, 'utf8');
    spec = yaml.load(specContent) as OpenApiSpec;
  } catch (error) {
    logger.error('Failed to load OpenAPI spec for rate limiting:', error);
    // Fall back to global rate limiter if spec can't be loaded
    return createRateLimiter();
  }

  // Build map of endpoint-specific rate limiters
  const endpointLimiters = new Map<string, RateLimitRequestHandler>();
  const apiBasePath = '/api/v1';

  for (const [pathPattern, pathItem] of Object.entries(spec.paths || {})) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

    for (const method of methods) {
      const operation = pathItem[method] as OpenApiOperation | undefined;
      if (operation?.['x-rate-limit']) {
        const config = operation['x-rate-limit'];
        const key = `${method.toUpperCase()}:${apiBasePath}${pathPattern}`;

        logger.info(`Rate limit configured for ${key}: ${config.max} requests per ${config.windowMs / 1000}s`);

        endpointLimiters.set(key, rateLimit({
          windowMs: config.windowMs,
          max: config.max,
          message: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests from this IP, please try again later.',
            },
          },
          standardHeaders: true,
          legacyHeaders: false,
          handler: (req: Request, res: Response) => {
            logger.warn(`Rate limit exceeded for ${key} from IP: ${req.ip}`);
            res.status(429).json({
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests from this IP, please try again later.',
              },
            });
          },
        }));
      }
    }
  }

  // Create global fallback rate limiter
  const globalLimiter = createRateLimiter();

  // Return middleware that selects appropriate rate limiter
  return (req: Request, res: Response, next: NextFunction) => {
    // Normalize path by removing trailing slash and query params
    const normalizedPath = req.path.replace(/\/$/, '') || '/';
    const key = `${req.method}:${normalizedPath}`;

    // Check for exact match first
    let limiter = endpointLimiters.get(key);

    // If no exact match, try to match path patterns with parameters
    if (!limiter) {
      for (const [pattern, patternLimiter] of endpointLimiters) {
        if (matchesPathPattern(key, pattern)) {
          limiter = patternLimiter;
          break;
        }
      }
    }

    // Use endpoint-specific or global limiter
    (limiter || globalLimiter)(req, res, next);
  };
}

/**
 * Match a request path against an OpenAPI path pattern
 * Handles path parameters like /users/{id}
 */
function matchesPathPattern(requestKey: string, patternKey: string): boolean {
  const [reqMethod, reqPath] = requestKey.split(':');
  const [patternMethod, patternPath] = patternKey.split(':');

  if (reqMethod !== patternMethod) {
    return false;
  }

  const reqParts = reqPath.split('/').filter(Boolean);
  const patternParts = patternPath.split('/').filter(Boolean);

  if (reqParts.length !== patternParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const reqPart = reqParts[i];

    // Path parameter (e.g., {id}) matches any value
    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      continue;
    }

    if (patternPart !== reqPart) {
      return false;
    }
  }

  return true;
}

/**
 * HTTP request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(logMessage);
    } else if (res.statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.http(logMessage);
    }
  });

  next();
}
