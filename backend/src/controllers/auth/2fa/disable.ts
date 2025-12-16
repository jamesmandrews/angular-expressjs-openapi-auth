import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../../models/userStore';
import { twoFactorStore } from '../../../models/twoFactorStore';
import { backupCodeStore } from '../../../models/backupCodeStore';
import { verifyTOTPCode } from '../../../utils/totp';
import { verifyPassword } from '../../../utils/password';
import { ErrorResponse } from '../../../types/common.types';
import { audit } from '../../../utils/auditLogger';
import { emitEvent } from '../../../utils/events';

interface Disable2FABody {
  password: string;
  code: string;
}

export default async function disable2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const { password, code } = req.body as Disable2FABody;

    // Get user to verify password
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

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password is incorrect',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Check if 2FA is enabled
    const settings = await twoFactorStore.getSettings(userId);
    if (!settings?.totpEnabled) {
      const errorResponse: ErrorResponse = {
        error: {
          code: '2FA_NOT_ENABLED',
          message: 'Two-factor authentication is not enabled.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Verify TOTP code
    if (!settings.totpSecret) {
      const errorResponse: ErrorResponse = {
        error: {
          code: '2FA_NOT_SETUP',
          message: 'Two-factor authentication is not properly set up.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    const isValidCode = verifyTOTPCode(code, settings.totpSecret);
    if (!isValidCode) {
      // Try backup code
      const backupResult = await backupCodeStore.verify(userId, code);
      if (!backupResult.valid) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INVALID_2FA_CODE',
            message: 'The verification code is invalid.',
          },
        };
        res.status(400).json(errorResponse);
        return;
      }
    }

    // Disable 2FA
    await twoFactorStore.disable2FA(userId);

    // Delete backup codes
    await backupCodeStore.deleteForUser(userId);

    // Audit 2FA disabled
    await audit.twoFactorDisabled(req, userId);
    await emitEvent('auth.2fa.disabled', req, {
      userId,
      email: user.email,
    });

    res.status(200).json({
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (error) {
    next(error);
  }
}
