import { query } from './connection';
import logger from '../utils/logger';

export async function initializeDatabase(): Promise<void> {
  logger.info('Initializing database schema...');

  // Create users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

  logger.info('Database schema initialized successfully');
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

  if (resetResult.length > 0 || blacklistResult.length > 0) {
    logger.debug(`Cleaned up ${resetResult.length} reset tokens and ${blacklistResult.length} blacklisted tokens`);
  }
}
