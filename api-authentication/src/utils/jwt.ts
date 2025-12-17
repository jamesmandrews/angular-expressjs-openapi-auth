import jwt from 'jsonwebtoken';
import { JwtPayload, OrganizationRole } from '../types/auth.types';

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

export interface GenerateTokenOptions {
  userId: string;
  email: string;
  roles?: string[];
  scopes?: string[];
  jti?: string; // Token salt for instant invalidation
  twoFactorPending?: boolean;
  twoFactorVerified?: boolean;
  expiresIn?: number; // Override default expiry
  organizationId?: string;
  organizationRole?: OrganizationRole;
}

export function generateAccessToken(options: GenerateTokenOptions): string {
  const expiresIn = options.expiresIn ?? getAccessTokenExpiry();
  const payload: Record<string, unknown> = {
    sub: options.userId,
    email: options.email,
    roles: options.roles ?? [],
    scopes: options.scopes ?? [],
  };

  // Add jti (token salt) for instant invalidation support
  if (options.jti) {
    payload.jti = options.jti;
  }

  // Add 2FA flags if present
  if (options.twoFactorPending !== undefined) {
    payload.twoFactorPending = options.twoFactorPending;
  }
  if (options.twoFactorVerified !== undefined) {
    payload.twoFactorVerified = options.twoFactorVerified;
  }

  // Add organization claims if present
  if (options.organizationId) {
    payload.organizationId = options.organizationId;
  }
  if (options.organizationRole) {
    payload.organizationRole = options.organizationRole;
  }

  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

/**
 * Generate a partial token for 2FA pending state (short expiry)
 */
export function generateTwoFactorPendingToken(userId: string, email: string): string {
  return generateAccessToken({
    userId,
    email,
    roles: [],
    scopes: [],
    twoFactorPending: true,
    expiresIn: 300, // 5 minutes for 2FA verification
  });
}

/**
 * Legacy function signature for backwards compatibility
 */
export function generateAccessTokenLegacy(userId: string, email: string, roles: string[] = [], scopes: string[] = []): { token: string; expiresIn: number } {
  const expiresIn = getAccessTokenExpiry();
  const token = generateAccessToken({ userId, email, roles, scopes });
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
