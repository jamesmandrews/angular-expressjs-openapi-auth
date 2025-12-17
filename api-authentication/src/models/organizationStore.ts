import { query, queryOne } from '../db/connection';
import { generateShortId } from '../utils/shortId';

export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: OrganizationRole;
  joinedAt: Date;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

interface MemberRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  organization_role: string;
  created_at: Date;
}

function rowToOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row: MemberRow): OrganizationMember {
  return {
    userId: row.id,
    email: row.email,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    role: row.organization_role as OrganizationRole,
    joinedAt: row.created_at,
  };
}

/**
 * Generate a URL-friendly slug from organization name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

class OrganizationStore {
  /**
   * Create a new organization and set the owner
   */
  async create(name: string, ownerId: string): Promise<Organization> {
    const id = generateShortId();
    let slug = generateSlug(name);

    // Ensure slug uniqueness by appending random suffix if needed
    const existingSlug = await this.getBySlug(slug);
    if (existingSlug) {
      slug = `${slug}-${generateShortId().substring(0, 6)}`;
    }

    const rows = await query<OrganizationRow>(
      `INSERT INTO organizations (id, name, slug, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, name, slug, ownerId]
    );

    // Set owner's organization membership
    await query(
      `UPDATE users
       SET organization_id = $1, organization_role = 'owner', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [id, ownerId]
    );

    return rowToOrganization(rows[0]);
  }

  async getById(id: string): Promise<Organization | undefined> {
    const row = await queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );
    return row ? rowToOrganization(row) : undefined;
  }

  async getBySlug(slug: string): Promise<Organization | undefined> {
    const row = await queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE slug = $1',
      [slug.toLowerCase()]
    );
    return row ? rowToOrganization(row) : undefined;
  }

  async getByOwnerId(ownerId: string): Promise<Organization | undefined> {
    const row = await queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE owner_id = $1',
      [ownerId]
    );
    return row ? rowToOrganization(row) : undefined;
  }

  async update(
    id: string,
    data: { name?: string }
  ): Promise<Organization | undefined> {
    const updates: string[] = [];
    const values: string[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
      // Also update slug when name changes
      let newSlug = generateSlug(data.name);

      // Ensure slug uniqueness (but allow keeping same slug if unchanged)
      const existingSlug = await this.getBySlug(newSlug);
      if (existingSlug && existingSlug.id !== id) {
        newSlug = `${newSlug}-${generateShortId().substring(0, 6)}`;
      }

      updates.push(`slug = $${paramIndex++}`);
      values.push(newSlug);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const rows = await query<OrganizationRow>(
      `UPDATE organizations
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return rows[0] ? rowToOrganization(rows[0]) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    // First, remove all members from the organization
    await query(
      `UPDATE users
       SET organization_id = NULL, organization_role = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1`,
      [id]
    );

    // Delete the organization (invites will cascade delete)
    const result = await query(
      'DELETE FROM organizations WHERE id = $1 RETURNING id',
      [id]
    );
    return result.length > 0;
  }

  /**
   * Get all members of an organization
   */
  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    const rows = await query<MemberRow>(
      `SELECT id, email, first_name, last_name, organization_role, created_at
       FROM users
       WHERE organization_id = $1
       ORDER BY
         CASE organization_role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           ELSE 3
         END,
         created_at ASC`,
      [organizationId]
    );
    return rows.map(rowToMember);
  }

  /**
   * Get member count for an organization
   */
  async getMemberCount(organizationId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = $1',
      [organizationId]
    );
    return parseInt(row?.count || '0', 10);
  }

  /**
   * Add a user to an organization with a specific role
   */
  async addMember(
    organizationId: string,
    userId: string,
    role: OrganizationRole
  ): Promise<boolean> {
    const result = await query(
      `UPDATE users
       SET organization_id = $1, organization_role = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND organization_id IS NULL
       RETURNING id`,
      [organizationId, role, userId]
    );
    return result.length > 0;
  }

  /**
   * Remove a user from an organization
   */
  async removeMember(userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE users
       SET organization_id = NULL, organization_role = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [userId]
    );
    return result.length > 0;
  }

  /**
   * Update a member's role within the organization
   */
  async updateMemberRole(
    userId: string,
    newRole: OrganizationRole
  ): Promise<boolean> {
    const result = await query(
      `UPDATE users
       SET organization_role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND organization_id IS NOT NULL
       RETURNING id`,
      [newRole, userId]
    );
    return result.length > 0;
  }

  /**
   * Transfer ownership of an organization to another member
   */
  async transferOwnership(
    organizationId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<boolean> {
    // Update organization owner
    await query(
      `UPDATE organizations
       SET owner_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newOwnerId, organizationId]
    );

    // Demote current owner to admin
    await query(
      `UPDATE users
       SET organization_role = 'admin', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [currentOwnerId]
    );

    // Promote new owner
    await query(
      `UPDATE users
       SET organization_role = 'owner', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [newOwnerId]
    );

    return true;
  }

  /**
   * Check if a user is a member of a specific organization
   */
  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM users WHERE id = $1 AND organization_id = $2
      ) as exists`,
      [userId, organizationId]
    );
    return row?.exists || false;
  }

  /**
   * Get a user's role within their organization
   */
  async getUserOrgRole(userId: string): Promise<OrganizationRole | null> {
    const row = await queryOne<{ organization_role: string | null }>(
      'SELECT organization_role FROM users WHERE id = $1',
      [userId]
    );
    return (row?.organization_role as OrganizationRole) || null;
  }

  /**
   * Get a user's organization
   */
  async getUserOrganization(userId: string): Promise<Organization | undefined> {
    const row = await queryOne<OrganizationRow>(
      `SELECT o.* FROM organizations o
       JOIN users u ON u.organization_id = o.id
       WHERE u.id = $1`,
      [userId]
    );
    return row ? rowToOrganization(row) : undefined;
  }
}

export const organizationStore = new OrganizationStore();
