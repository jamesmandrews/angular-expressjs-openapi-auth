import { Request, Response, NextFunction } from 'express';
import { twoFactorStore } from '../../../models/twoFactorStore';
import { backupCodeStore } from '../../../models/backupCodeStore';
import { userStore } from '../../../models/userStore';
import { roleStore } from '../../../models/roleStore';
import { scopeStore } from '../../../models/scopeStore';
import { refreshTokenStore } from '../../../models/refreshTokenStore';
import { verifyTOTPCode } from '../../../utils/totp';
import { generateAccessToken } from '../../../utils/jwt';
import { setRefreshTokenCookie, getClientIp, getUserAgent } from '../../../utils/cookies';
import { toUserPublic } from '../../../types/auth.types';
import { ErrorResponse } from '../../../types/common.types';
import { audit } from '../../../utils/auditLogger';

interface Verify2FABody {
  code: string;
}

export default async function verify2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const isTwoFactorPending = req.user?.twoFactorPending;

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

    // This endpoint should only be called with a 2FA pending token
    if (!isTwoFactorPending) {
      const errorResponse: ErrorResponse = {
        error: {
          code: '2FA_NOT_REQUIRED',
          message: 'Two-factor authentication verification is not required for this session.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    const { code } = req.body as Verify2FABody;

    // Get 2FA settings
    const settings = await twoFactorStore.getSettings(userId);

    if (!settings?.totpEnabled || !settings.totpSecret) {
      const errorResponse: ErrorResponse = {
        error: {
          code: '2FA_NOT_ENABLED',
          message: 'Two-factor authentication is not enabled for this account.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Try TOTP code first
    let isValid = verifyTOTPCode(code, settings.totpSecret);
    let usedBackupCode = false;
    let remainingBackupCodes: number | undefined;

    if (!isValid) {
      // Try backup code
      const backupResult = await backupCodeStore.verify(userId, code);
      isValid = backupResult.valid;
      if (backupResult.valid) {
        usedBackupCode = true;
        remainingBackupCodes = backupResult.remainingCodes;

        // Audit backup code usage
        await audit.backupCodeUsed(req, userId, remainingBackupCodes || 0);
      }
    }

    if (!isValid) {
      // Audit failed 2FA attempt
      await audit.twoFactorVerify(req, userId, false, usedBackupCode ? 'backup_code' : 'totp');

      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_2FA_CODE',
          message: 'The verification code is invalid. Please try again.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Get user info for full token
    const user = await userStore.getById(userId);
    if (!user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'User not found',
        },
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Get roles and scopes
    const userRoles = await roleStore.getUserRoles(userId);
    const roleNames = userRoles.map(r => r.name);
    const userScopes = await scopeStore.getUserScopes(userId);

    // Generate full access token (not 2FA pending)
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: roleNames,
      scopes: userScopes,
      twoFactorVerified: true,
    });

    // Create refresh token and set in HttpOnly cookie
    const refreshToken = await refreshTokenStore.create(user.id, {
      userAgent: getUserAgent(req),
      ipAddress: getClientIp(req),
    });
    setRefreshTokenCookie(res, refreshToken.rawToken);

    // Audit successful 2FA verification
    await audit.twoFactorVerify(req, userId, true, usedBackupCode ? 'backup_code' : 'totp');

    const response: {
      message: string;
      data: {
        user: ReturnType<typeof toUserPublic>;
        tokens: {
          accessToken: string;
          expiresIn: number;
          tokenType: string;
        };
        twoFactorVerified: boolean;
        backupCodeUsed?: boolean;
        remainingBackupCodes?: number;
        backupCodeWarning?: string;
      };
    } = {
      message: 'Two-factor authentication verified successfully.',
      data: {
        user: toUserPublic(user, roleNames, userScopes, true),
        tokens: {
          accessToken,
          expiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '900', 10),
          tokenType: 'Bearer',
        },
        twoFactorVerified: true,
      },
    };

    // Add backup code warning if used
    if (usedBackupCode) {
      response.data.backupCodeUsed = true;
      response.data.remainingBackupCodes = remainingBackupCodes;
      if (remainingBackupCodes !== undefined && remainingBackupCodes <= 3) {
        response.data.backupCodeWarning = `You have ${remainingBackupCodes} backup codes remaining. Consider regenerating them.`;
      }
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
