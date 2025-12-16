import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { emailVerificationTokenStore } from '../../models/tokenStore';
import { roleStore } from '../../models/roleStore';
import { scopeStore } from '../../models/scopeStore';
import { twoFactorStore } from '../../models/twoFactorStore';
import { toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';
import { audit } from '../../utils/auditLogger';
import { emitEvent } from '../../utils/events';

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

    // Audit email verification
    await audit.emailVerified(req, user.id);
    await emitEvent('auth.email.verified', req, {
      userId: user.id,
      email: user.email,
    });

    // Get user roles and scopes
    const userRoles = await roleStore.getUserRoles(user.id);
    const roleNames = userRoles.map(r => r.name);
    const userScopes = await scopeStore.getUserScopes(user.id);

    // Check 2FA status
    const is2FAEnabled = await twoFactorStore.is2FAEnabled(user.id);

    res.status(200).json({
      message: 'Email verified successfully',
      data: toUserPublic(user, roleNames, userScopes, is2FAEnabled),
    });
  } catch (error) {
    next(error);
  }
}
