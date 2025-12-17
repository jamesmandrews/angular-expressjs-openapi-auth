import { Request, Response, NextFunction } from 'express';
import { OrganizationRole } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';

/**
 * Check if a user has a required organization role
 * Roles are hierarchical: owner > admin > member
 */
export function hasOrgRole(userRole: OrganizationRole | undefined, requiredRole: OrganizationRole): boolean {
  if (!userRole) return false;

  const roleHierarchy: Record<OrganizationRole, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Middleware factory that requires user to belong to an organization
 */
export function requireOrg() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    if (!req.user.organizationId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NO_ORGANIZATION',
          message: 'You must belong to an organization to access this resource',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    next();
  };
}

/**
 * Middleware factory that requires a minimum organization role
 * @param minRole - Minimum role required (member, admin, or owner)
 */
export function requireOrgRole(minRole: OrganizationRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    if (!req.user.organizationId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NO_ORGANIZATION',
          message: 'You must belong to an organization to access this resource',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    if (!hasOrgRole(req.user.organizationRole, minRole)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INSUFFICIENT_ORG_PERMISSIONS',
          message: `This action requires ${minRole} role or higher`,
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    next();
  };
}

/**
 * Helper to check org role in controllers without middleware
 * Returns true if user has sufficient permissions
 */
export function checkOrgRole(req: Request, minRole: OrganizationRole): boolean {
  if (!req.user?.organizationId) return false;
  return hasOrgRole(req.user.organizationRole, minRole);
}

/**
 * Helper to get org role error response
 */
export function orgRoleError(minRole: OrganizationRole): ErrorResponse {
  return {
    error: {
      code: 'INSUFFICIENT_ORG_PERMISSIONS',
      message: `This action requires ${minRole} role or higher`,
    },
  };
}

/**
 * Helper for no organization error response
 */
export const noOrgError: ErrorResponse = {
  error: {
    code: 'NO_ORGANIZATION',
    message: 'You must belong to an organization to access this resource',
  },
};
