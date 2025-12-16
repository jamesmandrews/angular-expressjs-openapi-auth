import { Request, Response, NextFunction } from 'express';
import { twoFactorStore } from '../../../models/twoFactorStore';
import { backupCodeStore } from '../../../models/backupCodeStore';
import { verifyTOTPCode } from '../../../utils/totp';
import { ErrorResponse } from '../../../types/common.types';
import { audit } from '../../../utils/auditLogger';
import { emitEvent } from '../../../utils/events';

interface VerifySetupBody {
  code: string;
}

export default async function verifySetup(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const { code } = req.body as VerifySetupBody;

    // Get 2FA settings
    const settings = await twoFactorStore.getSettings(userId);

    if (!settings?.totpSecret) {
      const errorResponse: ErrorResponse = {
        error: {
          code: '2FA_NOT_SETUP',
          message: 'Two-factor authentication has not been set up. Call /auth/2fa/setup first.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    if (settings.totpEnabled) {
      const errorResponse: ErrorResponse = {
        error: {
          code: '2FA_ALREADY_ENABLED',
          message: 'Two-factor authentication is already enabled.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Verify the TOTP code
    const isValid = verifyTOTPCode(code, settings.totpSecret);

    if (!isValid) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_2FA_CODE',
          message: 'The verification code is invalid. Please try again.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Enable 2FA
    await twoFactorStore.enable2FA(userId);

    // Generate backup codes
    const backupCodes = await backupCodeStore.generateForUser(userId);

    // Audit 2FA enabled
    await audit.twoFactorEnabled(req, userId);
    await emitEvent('auth.2fa.enabled', req, { userId });

    res.status(200).json({
      message: 'Two-factor authentication has been enabled successfully.',
      data: {
        enabled: true,
        backupCodes, // Show these to the user ONCE
        backupCodesWarning: 'Store these backup codes in a safe place. They will only be shown once.',
      },
    });
  } catch (error) {
    next(error);
  }
}
