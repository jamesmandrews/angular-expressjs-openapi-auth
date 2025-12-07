import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { roleStore } from '../../models/roleStore';
import { verifyPassword } from '../../utils/password';
import { generateAccessToken } from '../../utils/jwt';
import { LoginRequest, toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';

export default async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password }: LoginRequest = req.body;

    // Find user by email
    const user = await userStore.getByEmail(email);
    if (!user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Generate access token
    const { token, expiresIn } = generateAccessToken(user.id, user.email);

    // Get user roles
    const userRoles = await roleStore.getUserRoles(user.id);
    const roleNames = userRoles.map(r => r.name);

    res.status(200).json({
      data: {
        user: toUserPublic(user, roleNames),
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
