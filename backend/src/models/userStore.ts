import { query, queryOne } from '../db/connection';
import { User, RegisterRequest } from '../types/auth.types';
import { generateShortId } from '../utils/shortId';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  email_verified: boolean;
  token_salt: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    emailVerified: row.email_verified,
    tokenSalt: row.token_salt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class UserStore {
  async create(data: RegisterRequest, passwordHash: string): Promise<User> {
    const id = generateShortId();
    const tokenSalt = generateShortId();
    const rows = await query<UserRow>(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, token_salt)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.email.toLowerCase(), passwordHash, data.firstName || null, data.lastName || null, tokenSalt]
    );
    return rowToUser(rows[0]);
  }

  async getById(id: string): Promise<User | undefined> {
    const row = await queryOne<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return row ? rowToUser(row) : undefined;
  }

  async getByEmail(email: string): Promise<User | undefined> {
    const row = await queryOne<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return row ? rowToUser(row) : undefined;
  }

  async emailExists(email: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists',
      [email.toLowerCase()]
    );
    return row?.exists || false;
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<User | undefined> {
    const rows = await query<UserRow>(
      `UPDATE users
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [newPasswordHash, userId]
    );
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async verifyEmail(userId: string): Promise<User | undefined> {
    const rows = await query<UserRow>(
      `UPDATE users
       SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [userId]
    );
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string }
  ): Promise<User | undefined> {
    const updates: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    if (data.firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName || null);
    }

    if (data.lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName || null);
    }

    if (updates.length === 0) {
      return this.getById(userId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const rows = await query<UserRow>(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async regenerateTokenSalt(userId: string): Promise<string> {
    const newSalt = generateShortId();
    await query(
      `UPDATE users
       SET token_salt = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newSalt, userId]
    );
    return newSalt;
  }
}

export const userStore = new UserStore();
