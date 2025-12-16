import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { passwordResetTokenStore } from '../../models/tokenStore';
import { ForgotPasswordRequest } from '../../types/auth.types';
import { getEmailProvider } from '../../email';
import logger from '../../utils/logger';
import { audit } from '../../utils/auditLogger';
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

    // Send password reset email
    const emailProvider = getEmailProvider();
    const result = await emailProvider.send({
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    if (!result.success) {
      logger.error(`Failed to send password reset email to ${email}`, { error: result.error });
    }

    // Audit password reset request (even for non-existent emails for security monitoring)
    await audit.passwordResetRequest(req, email);
    await emitEvent('auth.password.reset.request', req, {
      email,
      userId: user?.id,
    });

    res.status(200).json({ message: successMessage });
  } catch (error) {
    next(error);
  }
}
