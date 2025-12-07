import { Request, Response, NextFunction } from 'express';
import YAML from 'yamljs';
import path from 'path';
import { AuthProvider } from '../auth/authProvider';
import { ErrorResponse } from '../types/common.types';

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
  const apiSpecPath = path.join(__dirname, '..', '..', 'openapi.yaml');
  const apiSpec = YAML.load(apiSpecPath);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Find the matching route in OpenAPI spec
      const securityRequirements = getSecurityRequirementsForRoute(
        apiSpec,
        req.method,
        req.path
      );

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

/**
 * Find security requirements for a specific route in the OpenAPI spec
 */
function getSecurityRequirementsForRoute(
  apiSpec: any,
  method: string,
  path: string
): any[] | null {
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

  return operation?.security || null;
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
