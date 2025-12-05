import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { generateAccessToken } from '../../utils/jwt';
import { RegisterRequest, toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';

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
    });
  } catch (error) {
    next(error);
  }
}
