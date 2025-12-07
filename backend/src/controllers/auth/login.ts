import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { roleStore } from '../../models/roleStore';
import { scopeStore } from '../../models/scopeStore';
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

    // Get user roles and scopes
    const userRoles = await roleStore.getUserRoles(user.id);
    const roleNames = userRoles.map(r => r.name);
    const userScopes = await scopeStore.getUserScopes(user.id);

    // Generate access token with roles and scopes
    const { token, expiresIn } = generateAccessToken(user.id, user.email, roleNames, userScopes);

    res.status(200).json({
      data: {
        user: toUserPublic(user, roleNames, userScopes),
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
