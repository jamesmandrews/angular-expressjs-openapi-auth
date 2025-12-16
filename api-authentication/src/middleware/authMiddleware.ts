import { Request, Response, NextFunction } from 'express';
import YAML from 'yamljs';
import { AuthProvider } from '../auth/authProvider';
import { ErrorResponse } from '../types/common.types';
import { resolveOpenApiPath } from '../utils/paths';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        scopes: string[];
        twoFactorPending?: boolean;
        twoFactorVerified?: boolean;
        emailVerified?: boolean;
      };
    }
  }
}

/**
 * Creates authentication middleware that reads security requirements from OpenAPI spec
 * @param authProvider - The authentication provider to use
 * @returns Express middleware function
 */
export function createAuthMiddleware(authProvider: AuthProvider) {
  // Load OpenAPI spec to determine which routes need auth
  const apiSpecPath = resolveOpenApiPath(__dirname);
  const apiSpec = YAML.load(apiSpecPath);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Find the matching operation in OpenAPI spec
      const operationInfo = getOperationInfo(apiSpec, req.method, req.path);
      const securityRequirements = operationInfo.security;

      // If no security requirements, allow access
      if (!securityRequirements || securityRequirements.length === 0) {
        next();
        return;
      }

      // Extract security scheme names
      const schemeNames = securityRequirements.flatMap(req => Object.keys(req));

      // Authenticate using the provider
      const authResult = await authProvider.authenticate(req, schemeNames);

      if (!authResult.authenticated) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'UNAUTHORIZED',
            message: authResult.error || 'Authentication required',
          },
        };
        res.status(401).json(errorResponse);
        return;
      }

      // Extract required scopes from OpenAPI security requirements
      // Format: security: [{bearerAuth: ['profile:read', 'profile:write']}]
      const requiredScopes = securityRequirements
        .filter((requirement: Record<string, string[]>) => 'bearerAuth' in requirement)
        .flatMap((requirement: Record<string, string[]>) => requirement.bearerAuth || []);

      // Check if this is a 2FA pending token trying to access a protected route
      // Only allow 2FA pending tokens on the 2FA verify endpoint
      const is2FAVerifyEndpoint = req.path.includes('/auth/2fa/verify');
      if (authResult.user?.twoFactorPending && !is2FAVerifyEndpoint) {
        const errorResponse: ErrorResponse = {
          error: {
            code: '2FA_REQUIRED',
            message: 'Two-factor authentication verification required. Please verify with your authenticator app.',
          },
        };
        res.status(403).json(errorResponse);
        return;
      }

      // Check if unverified email is trying to access restricted endpoints
      // Uses x-allow-unverified-email extension from OpenAPI spec
      if (authResult.user && authResult.user.emailVerified === false && !operationInfo.allowUnverifiedEmail) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Please verify your email address to access this resource.',
          },
        };
        res.status(403).json(errorResponse);
        return;
      }

      // Validate scopes if any are required
      if (requiredScopes.length > 0) {
        const userScopes = authResult.user?.scopes || [];
        const missingScopes = requiredScopes.filter((scope: string) => !userScopes.includes(scope));

        if (missingScopes.length > 0) {
          const errorResponse: ErrorResponse = {
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions',
              details: [{
                field: 'scopes',
                message: `Missing required scopes: ${missingScopes.join(', ')}`,
              }],
            },
          };
          res.status(403).json(errorResponse);
          return;
        }
      }

      // Attach user info to request for use in controllers
      req.user = authResult.user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication error occurred',
        },
      };
      res.status(500).json(errorResponse);
    }
  };
}

interface OperationInfo {
  security: any[] | null;
  allowUnverifiedEmail: boolean;
}

/**
 * Find operation info for a specific route in the OpenAPI spec
 * Returns security requirements and custom extensions
 */
function getOperationInfo(
  apiSpec: any,
  method: string,
  path: string
): OperationInfo {
  // Normalize path - remove query string and convert path parameters
  const cleanPath = path.split('?')[0];
  const apiPath = cleanPath.replace(/^\/api\/v1/, ''); // Remove base path

  // Try exact match first
  let operation = apiSpec.paths?.[apiPath]?.[method.toLowerCase()];

  // If no exact match, try parameter matching (e.g., /users/123 -> /users/{userId})
  if (!operation) {
    for (const specPath of Object.keys(apiSpec.paths || {})) {
      if (pathMatches(apiPath, specPath)) {
        operation = apiSpec.paths[specPath][method.toLowerCase()];
        break;
      }
    }
  }

  return {
    security: operation?.security || null,
    allowUnverifiedEmail: operation?.['x-allow-unverified-email'] === true,
  };
}

/**
 * Check if a request path matches an OpenAPI path template
 * e.g., /users/123 matches /users/{userId}
 */
function pathMatches(requestPath: string, specPath: string): boolean {
  const requestParts = requestPath.split('/').filter(p => p);
  const specParts = specPath.split('/').filter(p => p);

  if (requestParts.length !== specParts.length) {
    return false;
  }

  return specParts.every((part, index) => {
    return part.startsWith('{') || part === requestParts[index];
  });
}
