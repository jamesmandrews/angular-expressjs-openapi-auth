import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { passwordResetTokenStore } from '../../models/tokenStore';
import { ForgotPasswordRequest } from '../../types/auth.types';
import logger from '../../utils/logger';

export default async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email }: ForgotPasswordRequest = req.body;

    // Always return success to prevent email enumeration
    const successMessage = 'If an account with that email exists, a password reset link has been sent';

    // Find user by email
    const user = await userStore.getByEmail(email);
    if (!user) {
      // Don't reveal that user doesn't exist
      res.status(200).json({ message: successMessage });
      return;
    }

    // Create password reset token
    const resetToken = await passwordResetTokenStore.create(user.id);

    // In production, you would send an email here with the reset link
    // For now, log the token (DO NOT do this in production!)
    logger.info(`Password reset token for ${email}: ${resetToken.token}`);
    logger.info(`Reset link: http://localhost:3000/reset-password?token=${resetToken.token}`);

    res.status(200).json({ message: successMessage });
  } catch (error) {
    next(error);
  }
}
