import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { roleStore } from '../../models/roleStore';
import { scopeStore } from '../../models/scopeStore';
import { twoFactorStore } from '../../models/twoFactorStore';
import { toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';

export default async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    const user = await userStore.getById(userId);

    if (!user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'User not found',
        },
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Get user roles and scopes
    const userRoles = await roleStore.getUserRoles(user.id);
    const roleNames = userRoles.map(r => r.name);
    const userScopes = await scopeStore.getUserScopes(user.id);

    // Check 2FA status
    const is2FAEnabled = await twoFactorStore.is2FAEnabled(user.id);

    res.status(200).json({
      data: toUserPublic(user, roleNames, userScopes, is2FAEnabled),
    });
  } catch (error) {
    next(error);
  }
}
