import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { roleStore } from '../../models/roleStore';
import { scopeStore } from '../../models/scopeStore';
import { twoFactorStore } from '../../models/twoFactorStore';
import { toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';
import { emitEvent } from '../../utils/events';

interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
}

export default async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const { firstName, lastName } = req.body as UpdateProfileBody;

    // Check if there's anything to update
    if (firstName === undefined && lastName === undefined) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field (firstName or lastName) must be provided',
        },
      };
      res.status(422).json(errorResponse);
      return;
    }

    const updatedUser = await userStore.updateProfile(userId, { firstName, lastName });

    if (!updatedUser) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'User not found',
        },
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Emit event (audit handled via plugin)
    const updatedFields: string[] = [];
    if (firstName !== undefined) updatedFields.push('firstName');
    if (lastName !== undefined) updatedFields.push('lastName');
    await emitEvent('user.profile.updated', req, {
      userId: updatedUser.id,
      email: updatedUser.email,
      updatedFields,
    });

    // Get user roles and scopes
    const userRoles = await roleStore.getUserRoles(updatedUser.id);
    const roleNames = userRoles.map(r => r.name);
    const userScopes = await scopeStore.getUserScopes(updatedUser.id);

    // Check 2FA status
    const is2FAEnabled = await twoFactorStore.is2FAEnabled(updatedUser.id);

    res.status(200).json({
      message: 'Profile updated successfully',
      data: toUserPublic(updatedUser, roleNames, userScopes, is2FAEnabled),
    });
  } catch (error) {
    next(error);
  }
}
