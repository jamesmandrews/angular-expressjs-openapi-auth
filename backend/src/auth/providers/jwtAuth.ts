import { Request } from 'express';
import { AuthProvider, AuthResult } from '../authProvider';
import { verifyAccessToken } from '../../utils/jwt';
import { tokenBlacklistStore } from '../../models/tokenStore';
import { userStore } from '../../models/userStore';

export class JwtAuthProvider implements AuthProvider {
  async authenticate(req: Request, _securitySchemes: string[]): Promise<AuthResult> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        error: 'Missing or invalid Authorization header',
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return {
        authenticated: false,
        error: 'Invalid token',
      };
    }

    // Check if token is blacklisted (logged out)
    if (await tokenBlacklistStore.isBlacklisted(token)) {
      return {
        authenticated: false,
        error: 'Token has been revoked',
      };
    }

    // Verify JWT signature and expiration
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return {
        authenticated: false,
        error: 'Invalid or expired token',
      };
    }

    // Optionally verify user still exists
    const user = await userStore.getById(decoded.sub);
    if (!user) {
      return {
        authenticated: false,
        error: 'User not found',
      };
    }

    return {
      authenticated: true,
      user: {
        id: decoded.sub,
        email: decoded.email,
        roles: decoded.roles || [],
        scopes: decoded.scopes || [],
      },
    };
  }
}
