import { Request, Response, NextFunction } from 'express';
import { generateAccessToken } from '../../utils/jwt';
import { roleStore } from '../../models/roleStore';
import { scopeStore } from '../../models/scopeStore';
import { userStore } from '../../models/userStore';
import { refreshTokenStore } from '../../models/refreshTokenStore';
import { getRefreshTokenFromCookie, setRefreshTokenCookie, clearRefreshTokenCookie, getClientIp, getUserAgent } from '../../utils/cookies';
import { ErrorResponse } from '../../types/common.types';
import logger from '../../utils/logger';

export default async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get refresh token from HttpOnly cookie
    const refreshToken = getRefreshTokenFromCookie(req);

    if (!refreshToken) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'No refresh token provided',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Rotate the refresh token (validates old token, creates new one)
    const result = await refreshTokenStore.rotate(refreshToken, {
      userAgent: getUserAgent(req),
      ipAddress: getClientIp(req),
    });

    if (!result.success) {
      // Clear invalid cookie
      clearRefreshTokenCookie(res);

      // Log reuse detection for security monitoring
      if (result.reuseDetected) {
        logger.warn('Refresh token reuse detected - potential token theft');
      }

      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: result.error,
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Set new rotated refresh token in cookie
    setRefreshTokenCookie(res, result.token.rawToken);

    // Get user info for access token
    const user = await userStore.getById(result.userId);
    if (!user) {
      clearRefreshTokenCookie(res);
      const errorResponse: ErrorResponse = {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'User not found',
        },
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Fetch current roles and scopes from database
    const userRoles = await roleStore.getUserRoles(result.userId);
    const roleNames = userRoles.map(r => r.name);
    const userScopes = await scopeStore.getUserScopes(result.userId);

    // Generate new access token with fresh roles, scopes, and org info
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: roleNames,
      scopes: userScopes,
      jti: user.tokenSalt || undefined,
      organizationId: user.organizationId,
      organizationRole: user.organizationRole,
    });
    const expiresIn = parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '900', 10);

    res.status(200).json({
      data: {
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
