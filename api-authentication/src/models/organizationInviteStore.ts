import crypto from 'crypto';
import { query, queryOne } from '../db/connection';
import { generateShortId } from '../utils/shortId';
import { OrganizationRole } from './organizationStore';

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

export interface OrganizationInviteWithOrg extends OrganizationInvite {
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
  inviterFirstName?: string;
  inviterLastName?: string;
}

interface InviteRow {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

interface InviteWithOrgRow extends InviteRow {
  organization_name: string;
  organization_slug: string;
  inviter_email: string;
  inviter_first_name: string | null;
  inviter_last_name: string | null;
}

function rowToInvite(row: InviteRow): OrganizationInvite {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role as OrganizationRole,
    invitedBy: row.invited_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at || undefined,
    createdAt: row.created_at,
  };
}

function rowToInviteWithOrg(row: InviteWithOrgRow): OrganizationInviteWithOrg {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role as OrganizationRole,
    invitedBy: row.invited_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at || undefined,
    createdAt: row.created_at,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    inviterEmail: row.inviter_email,
    inviterFirstName: row.inviter_first_name || undefined,
    inviterLastName: row.inviter_last_name || undefined,
  };
}

/**
 * Hash a token using SHA256
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Default invite expiry: 7 days
const DEFAULT_INVITE_EXPIRY_HOURS = 24 * 7;

class OrganizationInviteStore {
  /**
   * Create a new invite and return the raw token (only returned once)
   */
  async create(
    organizationId: string,
    email: string,
    role: OrganizationRole,
    invitedBy: string,
    expiryHours: number = DEFAULT_INVITE_EXPIRY_HOURS
  ): Promise<{ invite: OrganizationInvite; rawToken: string }> {
    const id = generateShortId();
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const rows = await query<InviteRow>(
      `INSERT INTO organization_invites (id, organization_id, email, role, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, organizationId, email.toLowerCase(), role, tokenHash, invitedBy, expiresAt]
    );

    return {
      invite: rowToInvite(rows[0]),
      rawToken,
    };
  }

  /**
   * Get invite by ID
   */
  async getById(id: string): Promise<OrganizationInvite | undefined> {
    const row = await queryOne<InviteRow>(
      'SELECT * FROM organization_invites WHERE id = $1',
      [id]
    );
    return row ? rowToInvite(row) : undefined;
  }

  /**
   * Get invite by raw token (validates token hash)
   */
  async getByToken(rawToken: string): Promise<OrganizationInviteWithOrg | undefined> {
    const tokenHash = hashToken(rawToken);
    const row = await queryOne<InviteWithOrgRow>(
      `SELECT
        i.*,
        o.name as organization_name,
        o.slug as organization_slug,
        u.email as inviter_email,
        u.first_name as inviter_first_name,
        u.last_name as inviter_last_name
       FROM organization_invites i
       JOIN organizations o ON o.id = i.organization_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.token_hash = $1
         AND i.accepted_at IS NULL
         AND i.expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    return row ? rowToInviteWithOrg(row) : undefined;
  }

  /**
   * Get all pending invites for an organization
   */
  async getByOrganization(organizationId: string): Promise<OrganizationInvite[]> {
    const rows = await query<InviteRow>(
      `SELECT * FROM organization_invites
       WHERE organization_id = $1
         AND accepted_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`,
      [organizationId]
    );
    return rows.map(rowToInvite);
  }

  /**
   * Get all pending invites for an email address
   */
  async getByEmail(email: string): Promise<OrganizationInviteWithOrg[]> {
    const rows = await query<InviteWithOrgRow>(
      `SELECT
        i.*,
        o.name as organization_name,
        o.slug as organization_slug,
        u.email as inviter_email,
        u.first_name as inviter_first_name,
        u.last_name as inviter_last_name
       FROM organization_invites i
       JOIN organizations o ON o.id = i.organization_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.email = $1
         AND i.accepted_at IS NULL
         AND i.expires_at > CURRENT_TIMESTAMP
       ORDER BY i.created_at DESC`,
      [email.toLowerCase()]
    );
    return rows.map(rowToInviteWithOrg);
  }

  /**
   * Check if a pending invite exists for an email in an organization
   */
  async existsForEmail(
    organizationId: string,
    email: string
  ): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM organization_invites
        WHERE organization_id = $1
          AND email = $2
          AND accepted_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
      ) as exists`,
      [organizationId, email.toLowerCase()]
    );
    return row?.exists || false;
  }

  /**
   * Mark an invite as accepted
   */
  async markAccepted(id: string): Promise<boolean> {
    const result = await query(
      `UPDATE organization_invites
       SET accepted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND accepted_at IS NULL
       RETURNING id`,
      [id]
    );
    return result.length > 0;
  }

  /**
   * Revoke (delete) an invite
   */
  async revoke(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM organization_invites WHERE id = $1 RETURNING id',
      [id]
    );
    return result.length > 0;
  }

  /**
   * Revoke all invites for an email in an organization
   */
  async revokeForEmail(organizationId: string, email: string): Promise<number> {
    const result = await query(
      `DELETE FROM organization_invites
       WHERE organization_id = $1 AND email = $2
       RETURNING id`,
      [organizationId, email.toLowerCase()]
    );
    return result.length;
  }

  /**
   * Clean up expired invites
   */
  async cleanupExpired(): Promise<number> {
    const result = await query(
      `DELETE FROM organization_invites
       WHERE expires_at < CURRENT_TIMESTAMP OR accepted_at IS NOT NULL
       RETURNING id`
    );
    return result.length;
  }
}

export const organizationInviteStore = new OrganizationInviteStore();
