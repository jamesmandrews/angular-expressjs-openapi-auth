import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { passwordResetTokenStore } from '../../models/tokenStore';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { ResetPasswordRequest } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';
import { audit } from '../../utils/auditLogger';

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

    // Mark token as used
    await passwordResetTokenStore.markUsed(token);

    // Audit password reset
    await audit.passwordReset(req, user.id);

    res.status(200).json({
      message: 'Password has been successfully reset',
    });
  } catch (error) {
    next(error);
  }
}
