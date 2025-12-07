import { Request, Response, NextFunction } from 'express';
import { twoFactorStore } from '../../../models/twoFactorStore';
import { backupCodeStore } from '../../../models/backupCodeStore';
import { verifyTOTPCode } from '../../../utils/totp';
import { ErrorResponse } from '../../../types/common.types';

interface RegenerateBackupCodesBody {
  code: string;
}

export default async function regenerateBackupCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const { code } = req.body as RegenerateBackupCodesBody;

    // Check if 2FA is enabled
    const settings = await twoFactorStore.getSettings(userId);
    if (!settings?.totpEnabled || !settings.totpSecret) {
      const errorResponse: ErrorResponse = {
        error: {
          code: '2FA_NOT_ENABLED',
          message: 'Two-factor authentication is not enabled.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Verify TOTP code (must be current code, not backup code)
    const isValid = verifyTOTPCode(code, settings.totpSecret);
    if (!isValid) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_2FA_CODE',
          message: 'The verification code is invalid. Please enter your current authenticator code.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Generate new backup codes (this deletes old ones)
    const backupCodes = await backupCodeStore.generateForUser(userId);

    res.status(200).json({
      message: 'New backup codes have been generated. Previous codes are now invalid.',
      data: {
        backupCodes,
        warning: 'Store these backup codes in a safe place. They will only be shown once.',
      },
    });
  } catch (error) {
    next(error);
  }
}
