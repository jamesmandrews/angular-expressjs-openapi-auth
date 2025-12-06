import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { emailVerificationTokenStore } from '../../models/tokenStore';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { generateAccessToken } from '../../utils/jwt';
import { RegisterRequest, toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';
import { getEmailProvider } from '../../email';
import logger from '../../utils/logger';

const getVerificationUrl = (): string => {
  return process.env.EMAIL_VERIFICATION_URL || 'http://localhost:4200/verify-email';
};

export default async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, firstName, lastName }: RegisterRequest = req.body;

    // Check if email already exists
    if (await userStore.emailExists(email)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'EMAIL_EXISTS',
          message: 'A user with this email address already exists',
        },
      };
      res.status(409).json(errorResponse);
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

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await userStore.create({ email, password, firstName, lastName }, passwordHash);

    // Create verification token and send email
    const verificationToken = await emailVerificationTokenStore.create(user.id);
    const verificationUrl = `${getVerificationUrl()}?token=${verificationToken.token}`;

    const emailProvider = getEmailProvider();
    const result = await emailProvider.send({
      to: email,
      subject: 'Verify Your Email Address',
      text: `Welcome! Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.`,
      html: `
        <h2>Welcome!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not create an account, please ignore this email.</p>
      `,
    });

    if (!result.success) {
      logger.error(`Failed to send verification email to ${email}`, { error: result.error });
    }

    // Generate access token
    const { token, expiresIn } = generateAccessToken(user.id, user.email);

    res.status(201).json({
      data: {
        user: toUserPublic(user),
        tokens: {
          accessToken: token,
          expiresIn,
          tokenType: 'Bearer',
        },
      },
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error) {
    next(error);
  }
}
