import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../../models/userStore';
import { twoFactorStore } from '../../../models/twoFactorStore';
import { generateTOTPSecret, generateOTPAuthURI, generateQRCodeDataURL } from '../../../utils/totp';
import { ErrorResponse } from '../../../types/common.types';

export default async function setup2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Get user
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

    // Check if 2FA is already enabled
    const settings = await twoFactorStore.getSettings(userId);
    if (settings?.totpEnabled) {
      const errorResponse: ErrorResponse = {
        error: {
          code: '2FA_ALREADY_ENABLED',
          message: 'Two-factor authentication is already enabled. Disable it first to set up again.',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Generate new TOTP secret
    const secret = generateTOTPSecret();

    // Store the secret (not enabled yet, just setup)
    await twoFactorStore.setTOTPSecret(userId, secret);

    // Generate OTP auth URI and QR code
    const otpAuthUri = generateOTPAuthURI(user.email, secret);
    const qrCodeDataUrl = await generateQRCodeDataURL(otpAuthUri);

    res.status(200).json({
      message: 'Two-factor authentication setup initiated. Scan the QR code with your authenticator app and verify with a code.',
      data: {
        secret, // For manual entry
        otpAuthUri, // For QR code generation on client
        qrCode: qrCodeDataUrl, // Base64 QR code image
      },
    });
  } catch (error) {
    next(error);
  }
}
