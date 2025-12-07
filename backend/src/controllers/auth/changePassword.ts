import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { verifyPassword, hashPassword } from '../../utils/password';
import { ErrorResponse } from '../../types/common.types';
import { audit } from '../../utils/auditLogger';

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export default async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const { currentPassword, newPassword } = req.body as ChangePasswordBody;

    // Get user to verify current password
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

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    await userStore.updatePassword(userId, newPasswordHash);

    // Audit password change
    await audit.passwordChange(req, userId);

    res.status(200).json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}
