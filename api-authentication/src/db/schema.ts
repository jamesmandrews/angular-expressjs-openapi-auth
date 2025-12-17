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

  // Add 2FA columns to users table (safe to run multiple times)
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)
  `);
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE
  `);
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMP WITH TIME ZONE
  `);

  // Add token_salt column for instant access token invalidation
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_salt VARCHAR(22)
  `);

  // Add canonical_email column for duplicate detection (strips plus aliases, dots for Gmail)
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS canonical_email VARCHAR(255)
  `);

  // Create index on canonical_email for duplicate lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_users_canonical_email ON users(canonical_email)
  `);

  // Create password reset tokens table (with hashed tokens for security)
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: rename token column to token_hash if old schema exists
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'password_reset_tokens' AND column_name = 'token'
      ) THEN
        -- Drop old table and recreate (tokens become invalid - users must request new)
        DROP TABLE password_reset_tokens CASCADE;
        CREATE TABLE password_reset_tokens (
          token_hash VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      END IF;
    END $$;
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

  // Create email verification tokens table (with hashed tokens for security)
  await query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token_hash VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: rename token column to token_hash if old schema exists
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'email_verification_tokens' AND column_name = 'token'
      ) THEN
        -- Drop old table and recreate (tokens become invalid - users must request new)
        DROP TABLE email_verification_tokens CASCADE;
        CREATE TABLE email_verification_tokens (
          token_hash VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      END IF;
    END $$;
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

  // Create scopes table
  await query(`
    CREATE TABLE IF NOT EXISTS scopes (
      id VARCHAR(22) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create role_scopes junction table (many-to-many)
  await query(`
    CREATE TABLE IF NOT EXISTS role_scopes (
      role_id VARCHAR(22) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      scope_id VARCHAR(22) NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, scope_id)
    )
  `);

  // Create indexes for role_scopes lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_role_scopes_role_id ON role_scopes(role_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_role_scopes_scope_id ON role_scopes(scope_id)
  `);

  // Create audit_logs table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(22) PRIMARY KEY,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      user_id VARCHAR(22) REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(50),
      resource_id VARCHAR(22),
      ip_address INET,
      user_agent VARCHAR(500),
      status VARCHAR(20) NOT NULL,
      details JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for audit_logs lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status)
  `);

  // Create backup_codes table for 2FA backup codes
  await query(`
    CREATE TABLE IF NOT EXISTS backup_codes (
      id VARCHAR(22) PRIMARY KEY,
      user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash VARCHAR(60) NOT NULL,
      used_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for backup_codes lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON backup_codes(user_id)
  `);

  // Create role_2fa_requirements table for configurable 2FA requirements by role
  await query(`
    CREATE TABLE IF NOT EXISTS role_2fa_requirements (
      role_id VARCHAR(22) PRIMARY KEY REFERENCES roles(id) ON DELETE CASCADE,
      required BOOLEAN DEFAULT FALSE,
      grace_period_hours INTEGER DEFAULT 0
    )
  `);

  // Create refresh_tokens table for secure refresh token storage
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id VARCHAR(22) PRIMARY KEY,
      user_id VARCHAR(22) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      family_id VARCHAR(22) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP WITH TIME ZONE,
      replaced_by VARCHAR(22),
      user_agent VARCHAR(500),
      ip_address INET
    )
  `);

  // Create indexes for refresh_tokens lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)
  `);

  // Create organizations table
  await query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(22) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      owner_id VARCHAR(22) NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for organizations lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id)
  `);

  // Add organization columns to users table
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id VARCHAR(22) REFERENCES organizations(id)
  `);
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_role VARCHAR(20)
  `);

  // Create index for users organization lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)
  `);

  // Create organization_invites table
  await query(`
    CREATE TABLE IF NOT EXISTS organization_invites (
      id VARCHAR(22) PRIMARY KEY,
      organization_id VARCHAR(22) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      token_hash VARCHAR(64) NOT NULL,
      invited_by VARCHAR(22) NOT NULL REFERENCES users(id),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      accepted_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for organization_invites lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_organization_invites_organization_id ON organization_invites(organization_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON organization_invites(email)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_organization_invites_token_hash ON organization_invites(token_hash)
  `);

  // Seed default roles if they don't exist
  await seedDefaultRoles();

  // Seed default scopes and role-scope mappings
  await seedDefaultScopes();

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

// Scope IDs for reference
const SCOPE_IDS = {
  PROFILE_READ: '0000000000000000000101',
  PROFILE_WRITE: '0000000000000000000102',
  USERS_READ: '0000000000000000000103',
  USERS_WRITE: '0000000000000000000104',
  USERS_DELETE: '0000000000000000000105',
  ADMIN_USERS: '0000000000000000000106',
  ADMIN_ROLES: '0000000000000000000107',
  ADMIN_SCOPES: '0000000000000000000108',
  ADMIN_READ: '0000000000000000000109',
  // Organization scopes
  ORG_READ: '0000000000000000000201',
  ORG_WRITE: '0000000000000000000202',
  ORG_MEMBERS_READ: '0000000000000000000203',
  ORG_MEMBERS_WRITE: '0000000000000000000204',
  ORG_INVITES_READ: '0000000000000000000205',
  ORG_INVITES_WRITE: '0000000000000000000206',
} as const;

// Role IDs for reference
const ROLE_IDS = {
  ADMIN: '0000000000000000000001',
  USER: '0000000000000000000002',
  MODERATOR: '0000000000000000000003',
} as const;

async function seedDefaultScopes(): Promise<void> {
  const defaultScopes = [
    { id: SCOPE_IDS.PROFILE_READ, name: 'profile:read', description: 'Read own profile' },
    { id: SCOPE_IDS.PROFILE_WRITE, name: 'profile:write', description: 'Update own profile' },
    { id: SCOPE_IDS.USERS_READ, name: 'users:read', description: 'View user profiles' },
    { id: SCOPE_IDS.USERS_WRITE, name: 'users:write', description: 'Modify users' },
    { id: SCOPE_IDS.USERS_DELETE, name: 'users:delete', description: 'Delete users' },
    { id: SCOPE_IDS.ADMIN_USERS, name: 'admin:users', description: 'Full user management' },
    { id: SCOPE_IDS.ADMIN_ROLES, name: 'admin:roles', description: 'Role management' },
    { id: SCOPE_IDS.ADMIN_SCOPES, name: 'admin:scopes', description: 'Scope management' },
    { id: SCOPE_IDS.ADMIN_READ, name: 'admin:read', description: 'Read admin data (audit logs, etc.)' },
    // Organization scopes
    { id: SCOPE_IDS.ORG_READ, name: 'org:read', description: 'Read organization details' },
    { id: SCOPE_IDS.ORG_WRITE, name: 'org:write', description: 'Update organization details' },
    { id: SCOPE_IDS.ORG_MEMBERS_READ, name: 'org:members:read', description: 'View organization members' },
    { id: SCOPE_IDS.ORG_MEMBERS_WRITE, name: 'org:members:write', description: 'Manage organization members' },
    { id: SCOPE_IDS.ORG_INVITES_READ, name: 'org:invites:read', description: 'View organization invites' },
    { id: SCOPE_IDS.ORG_INVITES_WRITE, name: 'org:invites:write', description: 'Manage organization invites' },
  ];

  // Insert scopes
  for (const scope of defaultScopes) {
    await query(
      `INSERT INTO scopes (id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING`,
      [scope.id, scope.name, scope.description]
    );
  }

  // Define role-scope mappings
  const roleScopeMappings: { roleId: string; scopeIds: string[] }[] = [
    {
      roleId: ROLE_IDS.ADMIN,
      scopeIds: Object.values(SCOPE_IDS), // Admin gets all scopes
    },
    {
      roleId: ROLE_IDS.MODERATOR,
      scopeIds: [
        SCOPE_IDS.PROFILE_READ,
        SCOPE_IDS.PROFILE_WRITE,
        SCOPE_IDS.USERS_READ,
      ],
    },
    {
      roleId: ROLE_IDS.USER,
      scopeIds: [
        SCOPE_IDS.PROFILE_READ,
        SCOPE_IDS.PROFILE_WRITE,
      ],
    },
  ];

  // Insert role-scope mappings
  for (const mapping of roleScopeMappings) {
    for (const scopeId of mapping.scopeIds) {
      await query(
        `INSERT INTO role_scopes (role_id, scope_id)
         VALUES ($1, $2)
         ON CONFLICT (role_id, scope_id) DO NOTHING`,
        [mapping.roleId, scopeId]
      );
    }
  }
}

export async function cleanupExpiredTokens(): Promise<void> {
  // Clean up expired password reset tokens
  const resetResult = await query(`
    DELETE FROM password_reset_tokens
    WHERE expires_at < CURRENT_TIMESTAMP OR used = TRUE
    RETURNING token_hash
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
    RETURNING token_hash
  `);

  // Clean up expired or revoked refresh tokens
  const refreshResult = await query(`
    DELETE FROM refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP OR revoked_at IS NOT NULL
    RETURNING id
  `);

  const totalCleaned = resetResult.length + blacklistResult.length + verificationResult.length + refreshResult.length;
  if (totalCleaned > 0) {
    logger.debug(`Cleaned up ${resetResult.length} reset tokens, ${blacklistResult.length} blacklisted tokens, ${verificationResult.length} verification tokens, and ${refreshResult.length} refresh tokens`);
  }
}

export async function cleanupOldAuditLogs(): Promise<number> {
  const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);

  const result = await query(`
    DELETE FROM audit_logs
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days'
    RETURNING id
  `);

  if (result.length > 0) {
    logger.debug(`Cleaned up ${result.length} audit logs older than ${retentionDays} days`);
  }

  return result.length;
}
