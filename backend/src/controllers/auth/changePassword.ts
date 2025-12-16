import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { refreshTokenStore } from '../../models/refreshTokenStore';
import { verifyPassword, hashPassword, validatePasswordStrength } from '../../utils/password';
import { clearRefreshTokenCookie } from '../../utils/cookies';
import { ErrorResponse } from '../../types/common.types';
import { audit } from '../../utils/auditLogger';
import { emitEvent } from '../../utils/events';
import logger from '../../utils/logger';

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

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'New password does not meet security requirements',
          details: [{ field: 'newPassword', message: passwordValidation.message || 'Invalid password' }],
        },
      };
      res.status(422).json(errorResponse);
      return;
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    await userStore.updatePassword(userId, newPasswordHash);

    // Revoke all refresh tokens for this user (force re-login on all devices)
    const revokedCount = await refreshTokenStore.revokeAllForUser(userId);
    logger.info(`Revoked ${revokedCount} refresh tokens after password change for user ${userId}`);

    // Regenerate token salt to invalidate all existing access tokens immediately
    await userStore.regenerateTokenSalt(userId);

    // Clear the current session's refresh token cookie
    clearRefreshTokenCookie(res);

    // Audit password change
    await audit.passwordChange(req, userId);
    await emitEvent('auth.password.change', req, {
      userId,
      email: user.email,
    });

    res.status(200).json({
      message: 'Password changed successfully. You have been logged out from all devices.',
    });
  } catch (error) {
    next(error);
  }
}
