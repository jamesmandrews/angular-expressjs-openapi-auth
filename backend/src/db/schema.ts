import { query } from './connection';
import logger from '../utils/logger';

export async function initializeDatabase(): Promise<void> {
  logger.info('Initializing database schema...');

  // Create users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(22) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      email_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on email for faster lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
  `);

  // Create password reset tokens table
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on user_id for faster lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)
  `);

  // Create token blacklist table (for logout)
  await query(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      token_hash VARCHAR(64) PRIMARY KEY,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on expires_at for cleanup queries
  await query(`
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at)
  `);

  // Create email verification tokens table
  await query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on user_id for faster lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id)
  `);

  // Create roles table
  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(22) PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      description VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create user_roles junction table (many-to-many)
  await query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id VARCHAR(22) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id)
    )
  `);

  // Create indexes for user_roles lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)
  `);

  // Seed default roles if they don't exist
  await seedDefaultRoles();

  logger.info('Database schema initialized successfully');
}

async function seedDefaultRoles(): Promise<void> {
  const defaultRoles = [
    { id: '0000000000000000000001', name: 'admin', description: 'Full system access' },
    { id: '0000000000000000000002', name: 'user', description: 'Standard user access' },
    { id: '0000000000000000000003', name: 'moderator', description: 'Content moderation access' },
  ];

  for (const role of defaultRoles) {
    await query(
      `INSERT INTO roles (id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING`,
      [role.id, role.name, role.description]
    );
  }
}

export async function cleanupExpiredTokens(): Promise<void> {
  // Clean up expired password reset tokens
  const resetResult = await query(`
    DELETE FROM password_reset_tokens
    WHERE expires_at < CURRENT_TIMESTAMP OR used = TRUE
    RETURNING token
  `);

  // Clean up expired blacklisted tokens
  const blacklistResult = await query(`
    DELETE FROM token_blacklist
    WHERE expires_at < CURRENT_TIMESTAMP
    RETURNING token_hash
  `);

  // Clean up expired email verification tokens
  const verificationResult = await query(`
    DELETE FROM email_verification_tokens
    WHERE expires_at < CURRENT_TIMESTAMP OR used = TRUE
    RETURNING token
  `);

  const totalCleaned = resetResult.length + blacklistResult.length + verificationResult.length;
  if (totalCleaned > 0) {
    logger.debug(`Cleaned up ${resetResult.length} reset tokens, ${blacklistResult.length} blacklisted tokens, and ${verificationResult.length} verification tokens`);
  }
}
