import { Request, Response, NextFunction } from 'express';
import { refreshTokenStore } from '../../models/refreshTokenStore';
import { clearRefreshTokenCookie } from '../../utils/cookies';
import { ErrorResponse } from '../../types/common.types';
import { audit } from '../../utils/auditLogger';
import logger from '../../utils/logger';

export default async function logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Revoke all refresh tokens for this user
    const revokedCount = await refreshTokenStore.revokeAllForUser(userId);
    logger.info(`User ${userId} logged out from all devices. ${revokedCount} sessions revoked.`);

    // Clear the current session's refresh token cookie
    clearRefreshTokenCookie(res);

    // Audit logout all
    await audit.logout(req, userId);

    res.status(200).json({
      message: `Successfully logged out from all devices. ${revokedCount} session(s) terminated.`,
      data: {
        sessionsRevoked: revokedCount,
      },
    });
  } catch (error) {
    next(error);
  }
}
