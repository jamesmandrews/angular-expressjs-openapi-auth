import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { emailVerificationTokenStore } from '../../models/tokenStore';
import { roleStore } from '../../models/roleStore';
import { toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';

export default async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body;

    // Validate token
    const tokenValidation = await emailVerificationTokenStore.isValid(token);
    if (!tokenValidation.valid) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_VERIFICATION_TOKEN',
          message: tokenValidation.error || 'The verification token is invalid or has expired',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Update user's email_verified status
    const user = await userStore.verifyEmail(tokenValidation.userId!);

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

    // Mark token as used
    await emailVerificationTokenStore.markUsed(token);

    // Get user roles
    const userRoles = await roleStore.getUserRoles(user.id);
    const roleNames = userRoles.map(r => r.name);

    res.status(200).json({
      message: 'Email verified successfully',
      data: toUserPublic(user, roleNames),
    });
  } catch (error) {
    next(error);
  }
}
