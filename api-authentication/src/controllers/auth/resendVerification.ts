import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { emailVerificationTokenStore } from '../../models/tokenStore';
import { ErrorResponse } from '../../types/common.types';
import { emitEvent } from '../../utils/events';

const getVerificationUrl = (): string => {
  return process.env.EMAIL_VERIFICATION_URL || 'http://localhost:4200/verify-email';
};

export default async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Check if already verified
    if (user.emailVerified) {
      res.status(200).json({
        message: 'Email is already verified',
      });
      return;
    }

    // Create new verification token (this will delete any existing unused tokens)
    const verificationToken = await emailVerificationTokenStore.create(user.id);
    const verificationUrl = `${getVerificationUrl()}?token=${verificationToken.rawToken}`;

    // Emit plugin event (email sent via auth-emails plugin)
    await emitEvent('auth.email.resend', req, {
      userId: user.id,
      email: user.email,
      verificationUrl,
    });

    res.status(200).json({
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    next(error);
  }
}
