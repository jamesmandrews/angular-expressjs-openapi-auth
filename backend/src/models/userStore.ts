import { query, queryOne } from '../db/connection';
import { User, RegisterRequest } from '../types/auth.types';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  email_verified: boolean;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class UserStore {
  async create(data: RegisterRequest, passwordHash: string): Promise<User> {
    const rows = await query<UserRow>(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.email.toLowerCase(), passwordHash, data.firstName || null, data.lastName || null]
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
}

export const userStore = new UserStore();
