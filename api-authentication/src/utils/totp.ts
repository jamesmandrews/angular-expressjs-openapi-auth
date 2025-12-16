import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

// Get TOTP configuration from environment
const getTOTPConfig = () => ({
  issuer: process.env.TOTP_ISSUER || 'MyApp',
  window: parseInt(process.env.TOTP_WINDOW || '1', 10), // Accept codes ±1 time step
});

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate the OTP auth URI for QR code
 */
export function generateOTPAuthURI(email: string, secret: string): string {
  const config = getTOTPConfig();
  return authenticator.keyuri(email, config.issuer, secret);
}

/**
 * Generate a QR code data URL from the OTP auth URI
 */
export async function generateQRCodeDataURL(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 200,
  });
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(token: string, secret: string): boolean {
  const config = getTOTPConfig();

  // Configure the authenticator for this verification
  authenticator.options = {
    window: config.window,
  };

  return authenticator.verify({ token, secret });
}

/**
 * Generate a set of backup codes
 * Returns both plain codes (to show user) and hashed codes (for storage)
 */
export function generateBackupCodes(count: number = 10): { plain: string; hash: string }[] {
  const codes: { plain: string; hash: string }[] = [];
  const bcrypt = require('bcrypt');
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    const hash = bcrypt.hashSync(code, saltRounds);
    codes.push({ plain: code, hash });
  }

  return codes;
}

/**
 * Verify a backup code against its hash
 */
export async function verifyBackupCode(code: string, hash: string): Promise<boolean> {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(code.toUpperCase(), hash);
}
