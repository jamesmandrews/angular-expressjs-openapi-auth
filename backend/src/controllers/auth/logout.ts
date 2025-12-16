import { Request, Response, NextFunction } from 'express';
import { tokenBlacklistStore } from '../../models/tokenStore';
import { refreshTokenStore } from '../../models/refreshTokenStore';
import { getRefreshTokenFromCookie, clearRefreshTokenCookie } from '../../utils/cookies';
import { audit } from '../../utils/auditLogger';
import { emitEvent } from '../../utils/events';

export default async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    // Blacklist the access token (if feature enabled)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await tokenBlacklistStore.add(token);
    }

    // Revoke the refresh token from cookie
    const refreshToken = getRefreshTokenFromCookie(req);
    if (refreshToken) {
      await refreshTokenStore.revoke(refreshToken);
    }

    // Clear the refresh token cookie
    clearRefreshTokenCookie(res);

    // Audit logout
    if (req.user?.id) {
      await audit.logout(req, req.user.id);
      await emitEvent('auth.logout', req, { userId: req.user.id });
    }

    res.status(200).json({
      message: 'Successfully logged out',
    });
  } catch (error) {
    next(error);
  }
}
