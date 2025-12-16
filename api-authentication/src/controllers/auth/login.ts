import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { roleStore } from '../../models/roleStore';
import { scopeStore } from '../../models/scopeStore';
import { twoFactorStore } from '../../models/twoFactorStore';
import { refreshTokenStore } from '../../models/refreshTokenStore';
import { verifyPassword } from '../../utils/password';
import { generateAccessToken, generateTwoFactorPendingToken } from '../../utils/jwt';
import { setRefreshTokenCookie, getClientIp, getUserAgent } from '../../utils/cookies';
import { LoginRequest, toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';
import { emitEvent } from '../../utils/events';

export default async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password }: LoginRequest = req.body;

    // Find user by email
    const user = await userStore.getByEmail(email);
    if (!user) {
      await emitEvent('auth.login.failed', req, { email, reason: 'user_not_found' });
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
      await emitEvent('auth.login.failed', req, { email, reason: 'invalid_password' });
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

    // Check if 2FA is enabled for this user
    const is2FAEnabled = await twoFactorStore.is2FAEnabled(user.id);

    if (is2FAEnabled) {
      // Generate partial token for 2FA verification
      const partialToken = generateTwoFactorPendingToken(user.id, user.email);

      // Emit event (audit handled via plugin)
      await emitEvent('auth.login', req, {
        email: user.email,
        userId: user.id,
        twoFactorRequired: true,
      });

      res.status(200).json({
        data: {
          user: toUserPublic(user, roleNames, userScopes, is2FAEnabled),
          tokens: {
            accessToken: partialToken,
            expiresIn: 300, // 5 minutes to complete 2FA
            tokenType: 'Bearer',
          },
          twoFactorRequired: true,
        },
        message: 'Two-factor authentication required. Please verify with your authenticator app.',
      });
      return;
    }

    // No 2FA - generate full access token with roles and scopes
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: roleNames,
      scopes: userScopes,
      jti: user.tokenSalt || undefined,
    });
    const expiresIn = parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '900', 10);

    // Create refresh token and set in HttpOnly cookie
    const refreshToken = await refreshTokenStore.create(user.id, {
      userAgent: getUserAgent(req),
      ipAddress: getClientIp(req),
    });
    setRefreshTokenCookie(res, refreshToken.rawToken);

    // Emit event (audit handled via plugin)
    await emitEvent('auth.login', req, {
      email: user.email,
      userId: user.id,
      twoFactorRequired: false,
    });

    res.status(200).json({
      data: {
        user: toUserPublic(user, roleNames, userScopes, is2FAEnabled),
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
