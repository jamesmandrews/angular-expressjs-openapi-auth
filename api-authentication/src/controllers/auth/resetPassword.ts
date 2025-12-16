import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { passwordResetTokenStore } from '../../models/tokenStore';
import { refreshTokenStore } from '../../models/refreshTokenStore';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { clearRefreshTokenCookie } from '../../utils/cookies';
import { ResetPasswordRequest } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';
import { emitEvent } from '../../utils/events';
import logger from '../../utils/logger';

export default async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password }: ResetPasswordRequest = req.body;

    // Validate token
    const tokenValidation = await passwordResetTokenStore.isValid(token);
    if (!tokenValidation.valid) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: tokenValidation.error || 'The password reset token is invalid or has expired',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: passwordValidation.message || 'Password does not meet requirements',
          details: [{ field: 'password', message: passwordValidation.message || 'Invalid password' }],
        },
      };
      res.status(422).json(errorResponse);
      return;
    }

    // Update user password
    const passwordHash = await hashPassword(password);
    const user = await userStore.updatePassword(tokenValidation.userId!, passwordHash);

    if (!user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'User not found',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Revoke all refresh tokens for this user (force re-login on all devices)
    const revokedCount = await refreshTokenStore.revokeAllForUser(user.id);
    logger.info(`Revoked ${revokedCount} refresh tokens after password reset for user ${user.id}`);

    // Regenerate token salt to invalidate all existing access tokens immediately
    await userStore.regenerateTokenSalt(user.id);

    // Clear any refresh token cookie on this response
    clearRefreshTokenCookie(res);

    // Mark token as used
    await passwordResetTokenStore.markUsed(token);

    // Emit event (audit handled via plugin)
    await emitEvent('auth.password.reset', req, {
      userId: user.id,
      email: user.email,
    });

    res.status(200).json({
      message: 'Password has been successfully reset',
    });
  } catch (error) {
    next(error);
  }
}
