import { query } from '../db/connection';
import { generateShortId } from '../utils/shortId';
import { generateBackupCodes, verifyBackupCode } from '../utils/totp';

export interface BackupCode {
  id: string;
  userId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt: Date;
}

class BackupCodeStore {
  /**
   * Generate and store new backup codes for a user
   * This will delete any existing backup codes
   * Returns the plain text codes (to show to the user once)
   */
  async generateForUser(userId: string, count: number = 10): Promise<string[]> {
    // Delete existing backup codes
    await query(
      `DELETE FROM backup_codes WHERE user_id = $1`,
      [userId]
    );

    // Generate new codes
    const codes = generateBackupCodes(count);

    // Store hashed codes
    for (const code of codes) {
      const id = generateShortId();
      await query(
        `INSERT INTO backup_codes (id, user_id, code_hash, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [id, userId, code.hash]
      );
    }

    // Return plain text codes
    return codes.map(c => c.plain);
  }

  /**
   * Get all backup codes for a user
   */
  async getForUser(userId: string): Promise<BackupCode[]> {
    const rows = await query(
      `SELECT id, user_id, code_hash, used_at, created_at
       FROM backup_codes
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );

    return rows.map((row: { id: string; user_id: string; code_hash: string; used_at: string | null; created_at: string }) => ({
      id: row.id,
      userId: row.user_id,
      codeHash: row.code_hash,
      usedAt: row.used_at ? new Date(row.used_at) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get the count of remaining (unused) backup codes for a user
   */
  async getRemainingCount(userId: string): Promise<number> {
    const rows = await query(
      `SELECT COUNT(*) as count
       FROM backup_codes
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );

    return parseInt(rows[0].count, 10);
  }

  /**
   * Verify a backup code for a user
   * If valid, marks the code as used and returns true
   */
  async verify(userId: string, code: string): Promise<{ valid: boolean; remainingCodes?: number }> {
    // Get unused backup codes for the user
    const codes = await query(
      `SELECT id, code_hash
       FROM backup_codes
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );

    // Check each code
    for (const stored of codes) {
      const isValid = await verifyBackupCode(code, stored.code_hash);
      if (isValid) {
        // Mark code as used
        await query(
          `UPDATE backup_codes
           SET used_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [stored.id]
        );

        // Get remaining count
        const remainingCodes = await this.getRemainingCount(userId);

        return { valid: true, remainingCodes };
      }
    }

    return { valid: false };
  }

  /**
   * Delete all backup codes for a user
   */
  async deleteForUser(userId: string): Promise<void> {
    await query(
      `DELETE FROM backup_codes WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Check if user has any backup codes set up
   */
  async hasBackupCodes(userId: string): Promise<boolean> {
    const rows = await query(
      `SELECT COUNT(*) as count
       FROM backup_codes
       WHERE user_id = $1`,
      [userId]
    );

    return parseInt(rows[0].count, 10) > 0;
  }
}

export const backupCodeStore = new BackupCodeStore();
