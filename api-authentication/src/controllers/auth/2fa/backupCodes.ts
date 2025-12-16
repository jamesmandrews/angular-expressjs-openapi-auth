import { Request, Response, NextFunction } from 'express';
import { twoFactorStore } from '../../../models/twoFactorStore';
import { backupCodeStore } from '../../../models/backupCodeStore';
import { ErrorResponse } from '../../../types/common.types';

export default async function getBackupCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Get remaining backup codes count
    const remainingCount = await backupCodeStore.getRemainingCount(userId);

    res.status(200).json({
      data: {
        remainingCodes: remainingCount,
        warning: remainingCount <= 3 ? 'You have few backup codes remaining. Consider regenerating them.' : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
}
