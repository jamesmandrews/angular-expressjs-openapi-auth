import { query, queryOne } from '../db/connection';

export interface Role {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
}

function rowToRole(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    createdAt: row.created_at,
  };
}

class RoleStore {
  /**
   * Get all available roles
   */
  async getAll(): Promise<Role[]> {
    const rows = await query<RoleRow>('SELECT * FROM roles ORDER BY name');
    return rows.map(rowToRole);
  }

  /**
   * Get a role by ID
   */
  async getById(id: string): Promise<Role | undefined> {
    const row = await queryOne<RoleRow>('SELECT * FROM roles WHERE id = $1', [id]);
    return row ? rowToRole(row) : undefined;
  }

  /**
   * Get a role by name
   */
  async getByName(name: string): Promise<Role | undefined> {
    const row = await queryOne<RoleRow>('SELECT * FROM roles WHERE name = $1', [name.toLowerCase()]);
    return row ? rowToRole(row) : undefined;
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const rows = await query<RoleRow>(
      `SELECT r.* FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY r.name`,
      [userId]
    );
    return rows.map(rowToRole);
  }

  /**
   * Assign a role to a user
   */
  async assignRole(userId: string, roleId: string): Promise<boolean> {
    try {
      await query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleId]
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Assign a role to a user by role name
   */
  async assignRoleByName(userId: string, roleName: string): Promise<boolean> {
    const role = await this.getByName(roleName);
    if (!role) return false;
    return this.assignRole(userId, role.id);
  }

  /**
   * Remove a role from a user
   */
  async removeRole(userId: string, roleId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 RETURNING user_id',
      [userId, roleId]
    );
    return result.length > 0;
  }

  /**
   * Remove a role from a user by role name
   */
  async removeRoleByName(userId: string, roleName: string): Promise<boolean> {
    const role = await this.getByName(roleName);
    if (!role) return false;
    return this.removeRole(userId, role.id);
  }

  /**
   * Check if a user has a specific role
   */
  async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.name = $2
      ) as exists`,
      [userId, roleName.toLowerCase()]
    );
    return row?.exists || false;
  }

  /**
   * Check if a user has any of the specified roles
   */
  async userHasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.name = ANY($2)
      ) as exists`,
      [userId, roleNames.map(r => r.toLowerCase())]
    );
    return row?.exists || false;
  }

  /**
   * Set a user's roles (replaces all existing roles)
   */
  async setUserRoles(userId: string, roleIds: string[]): Promise<boolean> {
    try {
      // Remove all existing roles
      await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

      // Add new roles
      for (const roleId of roleIds) {
        await query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [userId, roleId]
        );
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const roleStore = new RoleStore();

// Export well-known role IDs for convenience
export const ROLE_IDS = {
  ADMIN: '0000000000000000000001',
  USER: '0000000000000000000002',
  MODERATOR: '0000000000000000000003',
} as const;
