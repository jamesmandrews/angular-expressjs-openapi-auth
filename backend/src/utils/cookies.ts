import { Request, Response } from 'express';

const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

const getRefreshTokenExpiry = (): number => {
  const expiry = process.env.REFRESH_TOKEN_EXPIRY;
  return expiry ? parseInt(expiry, 10) : 86400; // Default 24 hours
};

const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

/**
 * Set refresh token in HttpOnly cookie
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  const expirySeconds = getRefreshTokenExpiry();

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,                    // Not accessible via JavaScript
    secure: isProduction(),            // HTTPS only in production
    sameSite: 'strict',                // Prevent CSRF
    path: '/api/v1/auth',              // Only sent to auth endpoints
    maxAge: expirySeconds * 1000,      // Expiry in milliseconds
  });
}

/**
 * Clear refresh token cookie on logout
 */
export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
}

/**
 * Get refresh token from request cookie
 */
export function getRefreshTokenFromCookie(req: Request): string | undefined {
  return req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
}

/**
 * Get client IP address from request
 */
export function getClientIp(req: Request): string | undefined {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0];
    return ips.split(',')[0].trim();
  }

  // Fall back to remote address
  return req.socket?.remoteAddress;
}

/**
 * Get user agent from request
 */
export function getUserAgent(req: Request): string | undefined {
  const ua = req.headers['user-agent'];
  // Truncate to fit database column
  return ua ? ua.substring(0, 500) : undefined;
}
