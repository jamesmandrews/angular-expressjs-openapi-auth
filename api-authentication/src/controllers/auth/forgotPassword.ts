import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { passwordResetTokenStore } from '../../models/tokenStore';
import { ForgotPasswordRequest } from '../../types/auth.types';
import { emitEvent } from '../../utils/events';

const getResetUrl = (): string => {
  return process.env.PASSWORD_RESET_URL || 'http://localhost:3000/reset-password';
};

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
    const resetUrl = `${getResetUrl()}?token=${resetToken.rawToken}`;

    // Emit plugin event (audit + email handled via plugins)
    await emitEvent('auth.password.reset.request', req, {
      email,
      userId: user?.id,
      resetUrl,
    });

    res.status(200).json({ message: successMessage });
  } catch (error) {
    next(error);
  }
}
