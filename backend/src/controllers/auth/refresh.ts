import { Request, Response, NextFunction } from 'express';
import { generateAccessToken, decodeToken, shouldRefreshToken } from '../../utils/jwt';
import { scopeStore } from '../../models/scopeStore';

export default async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // User is already authenticated via middleware, so req.user is available
    const user = req.user;

    if (!user || !user.id || !user.email) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Get current token from header
    const authHeader = req.headers.authorization;
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (currentToken) {
      const payload = decodeToken(currentToken);
      if (payload) {
        const { shouldRefresh, elapsedPercent, thresholdPercent } = shouldRefreshToken(payload);

        if (!shouldRefresh) {
          // Token is still fresh, return current token info
          const remainingSeconds = payload.exp - Math.floor(Date.now() / 1000);
          res.status(200).json({
            accessToken: currentToken,
            expiresIn: remainingSeconds,
            tokenType: 'Bearer',
            refreshed: false,
            message: `Token is still fresh (${elapsedPercent}% elapsed, threshold is ${thresholdPercent}%)`,
          });
          return;
        }
      }
    }

    // Re-fetch scopes from database (they may have changed since token was issued)
    const userScopes = await scopeStore.getUserScopes(user.id);

    // Generate new access token with fresh scopes
    const { token, expiresIn } = generateAccessToken(user.id, user.email, userScopes);

    res.status(200).json({
      accessToken: token,
      expiresIn,
      tokenType: 'Bearer',
      refreshed: true,
    });
  } catch (error) {
    next(error);
  }
}
