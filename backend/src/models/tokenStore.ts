import { randomBytes, createHash } from 'crypto';
import { query, queryOne } from '../db/connection';
import { PasswordResetToken } from '../types/auth.types';

const getResetTokenExpiry = (): number => {
  const expiry = process.env.PASSWORD_RESET_TOKEN_EXPIRY;
  return expiry ? parseInt(expiry, 10) : 3600; // Default 1 hour
};

const getVerificationTokenExpiry = (): number => {
  const expiry = process.env.EMAIL_VERIFICATION_TOKEN_EXPIRY;
  return expiry ? parseInt(expiry, 10) : 86400; // Default 24 hours
};

const getAccessTokenExpiry = (): number => {
  const expiry = process.env.JWT_ACCESS_TOKEN_EXPIRY;
  return expiry ? parseInt(expiry, 10) : 900; // Default 15 minutes
};

const isBlacklistEnabled = (): boolean => {
  return process.env.ENABLE_TOKEN_BLACKLIST === 'true';
};

// Hash token for storage (don't store raw tokens)
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface ResetTokenRow {
  token_hash: string;
  user_id: string;
  expires_at: Date;
  used: boolean;
}

interface PasswordResetTokenResult {
  rawToken: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
}

class PasswordResetTokenStore {
  async create(userId: string): Promise<PasswordResetTokenResult> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expirySeconds = getResetTokenExpiry();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    await query(
      `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, userId, expiresAt]
    );

    return {
      rawToken,
      userId,
      expiresAt,
      used: false,
    };
  }

  async get(rawToken: string): Promise<PasswordResetToken | undefined> {
    const tokenHash = hashToken(rawToken);
    const row = await queryOne<ResetTokenRow>(
      'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    if (!row) return undefined;

    return {
      token: rawToken, // Return raw token for interface compatibility
      userId: row.user_id,
      expiresAt: row.expires_at,
      used: row.used,
    };
  }

  async markUsed(rawToken: string): Promise<boolean> {
    const tokenHash = hashToken(rawToken);
    const result = await query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = $1 RETURNING token_hash`,
      [tokenHash]
    );
    return result.length > 0;
  }

  async isValid(rawToken: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
    const resetToken = await this.get(rawToken);

    if (!resetToken) {
      return { valid: false, error: 'Invalid reset token' };
    }

    if (resetToken.used) {
      return { valid: false, error: 'Reset token has already been used' };
    }

    if (new Date() > resetToken.expiresAt) {
      return { valid: false, error: 'Reset token has expired' };
    }

    return { valid: true, userId: resetToken.userId };
  }

  async delete(rawToken: string): Promise<boolean> {
    const tokenHash = hashToken(rawToken);
    const result = await query(
      'DELETE FROM password_reset_tokens WHERE token_hash = $1 RETURNING token_hash',
      [tokenHash]
    );
    return result.length > 0;
  }
}

class TokenBlacklistStore {
  async add(token: string): Promise<void> {
    if (!isBlacklistEnabled()) {
      return; // Skip blacklisting when disabled
    }

    const tokenHash = hashToken(token);
    const expirySeconds = getAccessTokenExpiry();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    // Use ON CONFLICT to handle duplicate tokens gracefully
    await query(
      `INSERT INTO token_blacklist (token_hash, expires_at)
       VALUES ($1, $2)
       ON CONFLICT (token_hash) DO NOTHING`,
      [tokenHash, expiresAt]
    );
  }

  async isBlacklisted(token: string): Promise<boolean> {
    if (!isBlacklistEnabled()) {
      return false; // Never blacklisted when feature is disabled
    }

    const tokenHash = hashToken(token);
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM token_blacklist
        WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP
      ) as exists`,
      [tokenHash]
    );
    return row?.exists || false;
  }
}

interface EmailVerificationToken {
  token: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
}

interface EmailVerificationTokenResult {
  rawToken: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
}

interface VerificationTokenRow {
  token_hash: string;
  user_id: string;
  expires_at: Date;
  used: boolean;
}

class EmailVerificationTokenStore {
  async create(userId: string): Promise<EmailVerificationTokenResult> {
    // Delete any existing unused tokens for this user
    await query(
      'DELETE FROM email_verification_tokens WHERE user_id = $1 AND used = FALSE',
      [userId]
    );

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expirySeconds = getVerificationTokenExpiry();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    await query(
      `INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, userId, expiresAt]
    );

    return {
      rawToken,
      userId,
      expiresAt,
      used: false,
    };
  }

  async get(rawToken: string): Promise<EmailVerificationToken | undefined> {
    const tokenHash = hashToken(rawToken);
    const row = await queryOne<VerificationTokenRow>(
      'SELECT * FROM email_verification_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    if (!row) return undefined;

    return {
      token: rawToken, // Return raw token for interface compatibility
      userId: row.user_id,
      expiresAt: row.expires_at,
      used: row.used,
    };
  }

  async markUsed(rawToken: string): Promise<boolean> {
    const tokenHash = hashToken(rawToken);
    const result = await query(
      `UPDATE email_verification_tokens SET used = TRUE WHERE token_hash = $1 RETURNING token_hash`,
      [tokenHash]
    );
    return result.length > 0;
  }

  async isValid(rawToken: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
    const verificationToken = await this.get(rawToken);

    if (!verificationToken) {
      return { valid: false, error: 'Invalid verification token' };
    }

    if (verificationToken.used) {
      return { valid: false, error: 'Verification token has already been used' };
    }

    if (new Date() > verificationToken.expiresAt) {
      return { valid: false, error: 'Verification token has expired' };
    }

    return { valid: true, userId: verificationToken.userId };
  }

  async deleteForUser(userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM email_verification_tokens WHERE user_id = $1 RETURNING token_hash',
      [userId]
    );
    return result.length > 0;
  }
}

export const passwordResetTokenStore = new PasswordResetTokenStore();
export const tokenBlacklistStore = new TokenBlacklistStore();
export const emailVerificationTokenStore = new EmailVerificationTokenStore();
