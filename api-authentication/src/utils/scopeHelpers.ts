import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ErrorResponse } from '../types/common.types';

/**
 * Middleware factory that requires a specific scope.
 * Use this for additional scope checks beyond what OpenAPI defines.
 *
 * @example
 * router.delete('/users/:id', requireScope('users:delete'), deleteUser);
 */
export function requireScope(scope: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userScopes = req.user?.scopes || [];

    if (!userScopes.includes(scope)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: [{
            field: 'scopes',
            message: `Missing required scope: ${scope}`,
          }],
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    next();
  };
}

/**
 * Middleware factory that requires any of the specified scopes.
 *
 * @example
 * router.get('/admin', requireAnyScope(['admin:users', 'admin:all']), adminDashboard);
 */
export function requireAnyScope(scopes: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userScopes = req.user?.scopes || [];
    const hasAny = scopes.some(scope => userScopes.includes(scope));

    if (!hasAny) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: [{
            field: 'scopes',
            message: `Requires one of: ${scopes.join(', ')}`,
          }],
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    next();
  };
}

/**
 * Middleware factory that requires all of the specified scopes.
 *
 * @example
 * router.post('/users', requireAllScopes(['users:write', 'admin:users']), createUser);
 */
export function requireAllScopes(scopes: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userScopes = req.user?.scopes || [];
    const missingScopes = scopes.filter(scope => !userScopes.includes(scope));

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

    next();
  };
}

/**
 * Helper to check if user has a specific scope in controller logic.
 *
 * @example
 * if (hasScope(req, 'admin:all')) {
 *   // Allow admin-only operation
 * }
 */
export function hasScope(req: Request, scope: string): boolean {
  const userScopes = req.user?.scopes || [];
  return userScopes.includes(scope);
}

/**
 * Helper to check if user has any of the specified scopes.
 *
 * @example
 * if (hasAnyScope(req, ['admin:users', 'admin:all'])) {
 *   // Show admin content
 * }
 */
export function hasAnyScope(req: Request, scopes: string[]): boolean {
  const userScopes = req.user?.scopes || [];
  return scopes.some(scope => userScopes.includes(scope));
}

/**
 * Helper to check if user has all of the specified scopes.
 *
 * @example
 * if (hasAllScopes(req, ['users:read', 'users:write'])) {
 *   // Allow full user management
 * }
 */
export function hasAllScopes(req: Request, scopes: string[]): boolean {
  const userScopes = req.user?.scopes || [];
  return scopes.every(scope => userScopes.includes(scope));
}
