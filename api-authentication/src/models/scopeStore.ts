import { query } from '../db/connection';

export interface Scope {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}

class ScopeStore {
  /**
   * Get all scopes
   */
  async getAll(): Promise<Scope[]> {
    const rows = await query<{
      id: string;
      name: string;
      description: string | null;
      created_at: Date;
    }>('SELECT id, name, description, created_at FROM scopes ORDER BY name');

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get scope by ID
   */
  async getById(id: string): Promise<Scope | undefined> {
    const rows = await query<{
      id: string;
      name: string;
      description: string | null;
      created_at: Date;
    }>('SELECT id, name, description, created_at FROM scopes WHERE id = $1', [id]);

    if (rows.length === 0) {
      return undefined;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * Get scope by name
   */
  async getByName(name: string): Promise<Scope | undefined> {
    const rows = await query<{
      id: string;
      name: string;
      description: string | null;
      created_at: Date;
    }>('SELECT id, name, description, created_at FROM scopes WHERE name = $1', [name]);

    if (rows.length === 0) {
      return undefined;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * Get all scopes for a role
   */
  async getScopesForRole(roleId: string): Promise<Scope[]> {
    const rows = await query<{
      id: string;
      name: string;
      description: string | null;
      created_at: Date;
    }>(
      `SELECT s.id, s.name, s.description, s.created_at
       FROM scopes s
       INNER JOIN role_scopes rs ON s.id = rs.scope_id
       WHERE rs.role_id = $1
       ORDER BY s.name`,
      [roleId]
    );

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get all scope names for a user (via their roles)
   * This is the main method used for JWT token generation
   */
  async getUserScopes(userId: string): Promise<string[]> {
    const rows = await query<{ name: string }>(
      `SELECT DISTINCT s.name
       FROM scopes s
       INNER JOIN role_scopes rs ON s.id = rs.scope_id
       INNER JOIN user_roles ur ON rs.role_id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY s.name`,
      [userId]
    );

    return rows.map(row => row.name);
  }

  /**
   * Assign a scope to a role
   */
  async assignToRole(roleId: string, scopeId: string): Promise<boolean> {
    const result = await query(
      `INSERT INTO role_scopes (role_id, scope_id)
       VALUES ($1, $2)
       ON CONFLICT (role_id, scope_id) DO NOTHING
       RETURNING role_id`,
      [roleId, scopeId]
    );
    return result.length > 0;
  }

  /**
   * Remove a scope from a role
   */
  async removeFromRole(roleId: string, scopeId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM role_scopes
       WHERE role_id = $1 AND scope_id = $2
       RETURNING role_id`,
      [roleId, scopeId]
    );
    return result.length > 0;
  }

  /**
   * Check if a user has a specific scope (via their roles)
   */
  async userHasScope(userId: string, scopeName: string): Promise<boolean> {
    const rows = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM scopes s
       INNER JOIN role_scopes rs ON s.id = rs.scope_id
       INNER JOIN user_roles ur ON rs.role_id = ur.role_id
       WHERE ur.user_id = $1 AND s.name = $2`,
      [userId, scopeName]
    );
    return parseInt(rows[0].count, 10) > 0;
  }

  /**
   * Check if a user has any of the specified scopes
   */
  async userHasAnyScope(userId: string, scopeNames: string[]): Promise<boolean> {
    if (scopeNames.length === 0) return false;

    const placeholders = scopeNames.map((_, i) => `$${i + 2}`).join(', ');
    const rows = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM scopes s
       INNER JOIN role_scopes rs ON s.id = rs.scope_id
       INNER JOIN user_roles ur ON rs.role_id = ur.role_id
       WHERE ur.user_id = $1 AND s.name IN (${placeholders})`,
      [userId, ...scopeNames]
    );
    return parseInt(rows[0].count, 10) > 0;
  }

  /**
   * Check if a user has all of the specified scopes
   */
  async userHasAllScopes(userId: string, scopeNames: string[]): Promise<boolean> {
    if (scopeNames.length === 0) return true;

    const placeholders = scopeNames.map((_, i) => `$${i + 2}`).join(', ');
    const rows = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT s.name) as count
       FROM scopes s
       INNER JOIN role_scopes rs ON s.id = rs.scope_id
       INNER JOIN user_roles ur ON rs.role_id = ur.role_id
       WHERE ur.user_id = $1 AND s.name IN (${placeholders})`,
      [userId, ...scopeNames]
    );
    return parseInt(rows[0].count, 10) === scopeNames.length;
  }
}

export const scopeStore = new ScopeStore();

// Export scope IDs for reference
export const SCOPE_IDS = {
  PROFILE_READ: '0000000000000000000101',
  PROFILE_WRITE: '0000000000000000000102',
  USERS_READ: '0000000000000000000103',
  USERS_WRITE: '0000000000000000000104',
  USERS_DELETE: '0000000000000000000105',
  ADMIN_USERS: '0000000000000000000106',
  ADMIN_ROLES: '0000000000000000000107',
  ADMIN_SCOPES: '0000000000000000000108',
} as const;

// Export scope names for convenience
export const SCOPES = {
  PROFILE_READ: 'profile:read',
  PROFILE_WRITE: 'profile:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  ADMIN_USERS: 'admin:users',
  ADMIN_ROLES: 'admin:roles',
  ADMIN_SCOPES: 'admin:scopes',
} as const;
