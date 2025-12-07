import { query } from '../db/connection';

export interface TwoFactorSettings {
  userId: string;
  totpSecret: string | null;
  totpEnabled: boolean;
  totpVerifiedAt: Date | null;
}

export interface Role2FARequirement {
  roleId: string;
  roleName: string;
  required: boolean;
  gracePeriodHours: number;
}

class TwoFactorStore {
  /**
   * Get 2FA settings for a user
   */
  async getSettings(userId: string): Promise<TwoFactorSettings | null> {
    const rows = await query(
      `SELECT id, totp_secret, totp_enabled, totp_verified_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      userId: row.id,
      totpSecret: row.totp_secret,
      totpEnabled: row.totp_enabled,
      totpVerifiedAt: row.totp_verified_at ? new Date(row.totp_verified_at) : null,
    };
  }

  /**
   * Set the TOTP secret for a user (during setup, before verification)
   */
  async setTOTPSecret(userId: string, secret: string): Promise<void> {
    await query(
      `UPDATE users
       SET totp_secret = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [secret, userId]
    );
  }

  /**
   * Enable 2FA for a user (after TOTP verification)
   */
  async enable2FA(userId: string): Promise<void> {
    await query(
      `UPDATE users
       SET totp_enabled = TRUE, totp_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: string): Promise<void> {
    await query(
      `UPDATE users
       SET totp_enabled = FALSE, totp_secret = NULL, totp_verified_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Check if 2FA is enabled for a user
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    const rows = await query(
      `SELECT totp_enabled FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return false;
    }

    return rows[0].totp_enabled === true;
  }

  /**
   * Get the TOTP secret for a user (for verification)
   */
  async getTOTPSecret(userId: string): Promise<string | null> {
    const rows = await query(
      `SELECT totp_secret FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0].totp_secret;
  }

  /**
   * Get 2FA requirement for a role
   */
  async getRole2FARequirement(roleId: string): Promise<Role2FARequirement | null> {
    const rows = await query(
      `SELECT r2fa.role_id, r.name as role_name, r2fa.required, r2fa.grace_period_hours
       FROM role_2fa_requirements r2fa
       JOIN roles r ON r.id = r2fa.role_id
       WHERE r2fa.role_id = $1`,
      [roleId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      roleId: row.role_id,
      roleName: row.role_name,
      required: row.required,
      gracePeriodHours: row.grace_period_hours,
    };
  }

  /**
   * Get all roles that require 2FA
   */
  async getRolesRequiring2FA(): Promise<Role2FARequirement[]> {
    const rows = await query(
      `SELECT r2fa.role_id, r.name as role_name, r2fa.required, r2fa.grace_period_hours
       FROM role_2fa_requirements r2fa
       JOIN roles r ON r.id = r2fa.role_id
       WHERE r2fa.required = TRUE`
    );

    return rows.map((row: { role_id: string; role_name: string; required: boolean; grace_period_hours: number }) => ({
      roleId: row.role_id,
      roleName: row.role_name,
      required: row.required,
      gracePeriodHours: row.grace_period_hours,
    }));
  }

  /**
   * Set 2FA requirement for a role
   */
  async setRole2FARequirement(roleId: string, required: boolean, gracePeriodHours: number = 0): Promise<void> {
    await query(
      `INSERT INTO role_2fa_requirements (role_id, required, grace_period_hours)
       VALUES ($1, $2, $3)
       ON CONFLICT (role_id) DO UPDATE SET required = $2, grace_period_hours = $3`,
      [roleId, required, gracePeriodHours]
    );
  }

  /**
   * Check if a user needs to set up 2FA based on their roles
   */
  async userNeeds2FASetup(userId: string): Promise<{ required: boolean; reason?: string; gracePeriodEnds?: Date }> {
    // Get user's roles
    const userRoles = await query(
      `SELECT r.id, r.name
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );

    // Check if user already has 2FA enabled
    const settings = await this.getSettings(userId);
    if (settings?.totpEnabled) {
      return { required: false };
    }

    // Check environment variable for required roles
    const requiredRolesEnv = process.env.TWO_FACTOR_REQUIRED_ROLES || '';
    const requiredRoleNames = requiredRolesEnv.split(',').map(r => r.trim().toLowerCase()).filter(r => r);

    // Check if any of user's roles require 2FA
    for (const role of userRoles) {
      // Check environment variable
      if (requiredRoleNames.includes(role.name.toLowerCase())) {
        // Check database for grace period
        const requirement = await this.getRole2FARequirement(role.id);
        const gracePeriodHours = requirement?.gracePeriodHours || parseInt(process.env.TWO_FACTOR_GRACE_PERIOD_HOURS || '24', 10);

        // Get user creation date to calculate grace period
        const userRows = await query(`SELECT created_at FROM users WHERE id = $1`, [userId]);
        if (userRows.length > 0) {
          const userCreatedAt = new Date(userRows[0].created_at);
          const gracePeriodEnds = new Date(userCreatedAt.getTime() + gracePeriodHours * 60 * 60 * 1000);
          const now = new Date();

          if (now < gracePeriodEnds) {
            return {
              required: true,
              reason: `Role "${role.name}" requires 2FA`,
              gracePeriodEnds,
            };
          }
        }

        return {
          required: true,
          reason: `Role "${role.name}" requires 2FA`,
        };
      }

      // Check database requirements
      const requirement = await this.getRole2FARequirement(role.id);
      if (requirement?.required) {
        return {
          required: true,
          reason: `Role "${role.name}" requires 2FA`,
        };
      }
    }

    return { required: false };
  }
}

export const twoFactorStore = new TwoFactorStore();
