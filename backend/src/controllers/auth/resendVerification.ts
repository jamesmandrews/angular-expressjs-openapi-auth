import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { emailVerificationTokenStore } from '../../models/tokenStore';
import { ErrorResponse } from '../../types/common.types';
import { getEmailProvider } from '../../email';
import logger from '../../utils/logger';

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

    // Send verification email
    const emailProvider = getEmailProvider();
    const result = await emailProvider.send({
      to: user.email,
      subject: 'Verify Your Email Address',
      text: `Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <h2>Email Verification</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    if (!result.success) {
      logger.error(`Failed to send verification email to ${user.email}`, { error: result.error });
    }

    res.status(200).json({
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    next(error);
  }
}
