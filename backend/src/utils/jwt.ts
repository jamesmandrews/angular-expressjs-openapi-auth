import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/auth.types';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

const getAccessTokenExpiry = (): number => {
  const expiry = process.env.JWT_ACCESS_TOKEN_EXPIRY;
  return expiry ? parseInt(expiry, 10) : 900; // Default 15 minutes
};

const getRefreshThreshold = (): number => {
  const threshold = process.env.JWT_REFRESH_THRESHOLD_PERCENT;
  return threshold ? parseInt(threshold, 10) : 50; // Default 50%
};

export function generateAccessToken(userId: string, email: string, scopes: string[] = []): { token: string; expiresIn: number } {
  const expiresIn = getAccessTokenExpiry();
  const token = jwt.sign(
    { sub: userId, email, scopes },
    getJwtSecret(),
    { expiresIn }
  );
  return { token, expiresIn };
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Checks if a token has passed the refresh threshold.
 * Returns true if the token should be refreshed, false if it's still fresh.
 * Threshold is configurable via JWT_REFRESH_THRESHOLD_PERCENT (default 50%).
 */
export function shouldRefreshToken(payload: JwtPayload): {
  shouldRefresh: boolean;
  elapsedPercent: number;
  thresholdPercent: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const totalLifetime = payload.exp - payload.iat;
  const elapsed = now - payload.iat;
  const elapsedPercent = Math.round((elapsed / totalLifetime) * 100);
  const thresholdPercent = getRefreshThreshold();

  return {
    shouldRefresh: elapsedPercent >= thresholdPercent,
    elapsedPercent,
    thresholdPercent,
  };
}
