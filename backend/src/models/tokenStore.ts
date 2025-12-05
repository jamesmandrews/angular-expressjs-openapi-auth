import { randomBytes, createHash } from 'crypto';
import { query, queryOne } from '../db/connection';
import { PasswordResetToken } from '../types/auth.types';

const getResetTokenExpiry = (): number => {
  const expiry = process.env.PASSWORD_RESET_TOKEN_EXPIRY;
  return expiry ? parseInt(expiry, 10) : 3600; // Default 1 hour
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
  token: string;
  user_id: string;
  expires_at: Date;
  used: boolean;
}

class PasswordResetTokenStore {
  async create(userId: string): Promise<PasswordResetToken> {
    const token = randomBytes(32).toString('hex');
    const expirySeconds = getResetTokenExpiry();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    await query(
      `INSERT INTO password_reset_tokens (token, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [token, userId, expiresAt]
    );

    return {
      token,
      userId,
      expiresAt,
      used: false,
    };
  }

  async get(token: string): Promise<PasswordResetToken | undefined> {
    const row = await queryOne<ResetTokenRow>(
      'SELECT * FROM password_reset_tokens WHERE token = $1',
      [token]
    );

    if (!row) return undefined;

    return {
      token: row.token,
      userId: row.user_id,
      expiresAt: row.expires_at,
      used: row.used,
    };
  }

  async markUsed(token: string): Promise<boolean> {
    const result = await query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE token = $1 RETURNING token`,
      [token]
    );
    return result.length > 0;
  }

  async isValid(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
    const resetToken = await this.get(token);

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

  async delete(token: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM password_reset_tokens WHERE token = $1 RETURNING token',
      [token]
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

export const passwordResetTokenStore = new PasswordResetTokenStore();
export const tokenBlacklistStore = new TokenBlacklistStore();
