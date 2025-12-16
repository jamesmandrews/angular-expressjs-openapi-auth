import { randomBytes, createHash } from 'crypto';
import { query, queryOne } from '../db/connection';
import { generateShortId } from '../utils/shortId';
import logger from '../utils/logger';

const getRefreshTokenExpiry = (): number => {
  const expiry = process.env.REFRESH_TOKEN_EXPIRY;
  return expiry ? parseInt(expiry, 10) : 86400; // Default 24 hours
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
  replaced_by: string | null;
  user_agent: string | null;
  ip_address: string | null;
}

export interface RefreshTokenMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface RefreshTokenResult {
  rawToken: string;
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
}

export interface ActiveSession {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

class RefreshTokenStore {
  /**
   * Create a new refresh token for login (creates new token family)
   */
  async create(userId: string, metadata?: RefreshTokenMetadata): Promise<RefreshTokenResult> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const id = generateShortId();
    const familyId = generateShortId(); // New family for new login
    const expirySeconds = getRefreshTokenExpiry();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, tokenHash, familyId, expiresAt, metadata?.userAgent || null, metadata?.ipAddress || null]
    );

    return {
      rawToken,
      id,
      userId,
      familyId,
      expiresAt,
    };
  }

  /**
   * Rotate a refresh token - validates old token, creates new one, marks old as replaced
   * If reuse is detected (token already rotated), revokes entire family
   */
  async rotate(
    oldRawToken: string,
    metadata?: RefreshTokenMetadata
  ): Promise<{ success: true; token: RefreshTokenResult; userId: string } | { success: false; error: string; reuseDetected?: boolean }> {
    const oldTokenHash = hashToken(oldRawToken);

    // Find the old token
    const oldToken = await queryOne<RefreshTokenRow>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [oldTokenHash]
    );

    if (!oldToken) {
      return { success: false, error: 'Invalid refresh token' };
    }

    // Check if token has been revoked
    if (oldToken.revoked_at) {
      return { success: false, error: 'Refresh token has been revoked' };
    }

    // Check if token has expired
    if (new Date() > oldToken.expires_at) {
      return { success: false, error: 'Refresh token has expired' };
    }

    // CRITICAL: Check for reuse - if this token has already been rotated (replaced_by is set)
    // This indicates potential token theft - revoke entire family
    if (oldToken.replaced_by) {
      logger.warn(`Refresh token reuse detected! Family ${oldToken.family_id} for user ${oldToken.user_id}. Revoking all tokens in family.`);
      await this.revokeFamily(oldToken.family_id);
      return { success: false, error: 'Token reuse detected. All sessions in this family have been revoked.', reuseDetected: true };
    }

    // Create new token in same family
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const newId = generateShortId();
    const expirySeconds = getRefreshTokenExpiry();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    // Insert new token and mark old token as replaced (atomic operation)
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newId, oldToken.user_id, tokenHash, oldToken.family_id, expiresAt, metadata?.userAgent || null, metadata?.ipAddress || null]
    );

    await query(
      `UPDATE refresh_tokens SET replaced_by = $1 WHERE id = $2`,
      [newId, oldToken.id]
    );

    return {
      success: true,
      userId: oldToken.user_id,
      token: {
        rawToken,
        id: newId,
        userId: oldToken.user_id,
        familyId: oldToken.family_id,
        expiresAt,
      },
    };
  }

  /**
   * Validate a refresh token without rotation (for checking validity)
   */
  async validate(rawToken: string): Promise<{ valid: true; userId: string; familyId: string } | { valid: false; error: string }> {
    const tokenHash = hashToken(rawToken);

    const token = await queryOne<RefreshTokenRow>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    if (!token) {
      return { valid: false, error: 'Invalid refresh token' };
    }

    if (token.revoked_at) {
      return { valid: false, error: 'Refresh token has been revoked' };
    }

    if (new Date() > token.expires_at) {
      return { valid: false, error: 'Refresh token has expired' };
    }

    // Even for validation, check for reuse
    if (token.replaced_by) {
      return { valid: false, error: 'Refresh token has already been used' };
    }

    return { valid: true, userId: token.user_id, familyId: token.family_id };
  }

  /**
   * Revoke a single refresh token
   */
  async revoke(rawToken: string): Promise<boolean> {
    const tokenHash = hashToken(rawToken);

    const result = await query(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1 AND revoked_at IS NULL RETURNING id`,
      [tokenHash]
    );

    return result.length > 0;
  }

  /**
   * Revoke all tokens in a family (used for reuse detection)
   */
  async revokeFamily(familyId: string): Promise<number> {
    const result = await query(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE family_id = $1 AND revoked_at IS NULL RETURNING id`,
      [familyId]
    );

    if (result.length > 0) {
      logger.info(`Revoked ${result.length} tokens in family ${familyId}`);
    }

    return result.length;
  }

  /**
   * Revoke all refresh tokens for a user (logout all devices / password change)
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await query(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
      [userId]
    );

    if (result.length > 0) {
      logger.info(`Revoked ${result.length} refresh tokens for user ${userId}`);
    }

    return result.length;
  }

  /**
   * Get active sessions for a user (for session management UI)
   */
  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const rows = await query<RefreshTokenRow>(
      `SELECT id, created_at, expires_at, user_agent, ip_address
       FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP AND replaced_by IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    return rows.map(row => ({
      id: row.id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
    }));
  }

  /**
   * Cleanup expired tokens (called by scheduled job)
   */
  async cleanupExpired(): Promise<number> {
    const result = await query(
      `DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP OR revoked_at IS NOT NULL RETURNING id`
    );

    return result.length;
  }
}

export const refreshTokenStore = new RefreshTokenStore();
