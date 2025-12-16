import { query, queryOne } from '../db/connection';

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: 'success' | 'failure' | 'blocked';
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: 'success' | 'failure' | 'blocked';
  details?: Record<string, unknown> | null;
}

export interface AuditLogQuery {
  userId?: string;
  action?: string;
  status?: 'success' | 'failure' | 'blocked';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface AuditLogRow {
  id: string;
  timestamp: Date;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failure' | 'blocked';
  details: Record<string, unknown> | null;
  created_at: Date;
}

function rowToAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    userId: row.user_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    status: row.status,
    details: row.details,
    createdAt: row.created_at,
  };
}

class AuditLogStore {
  /**
   * Create a new audit log entry
   */
  async create(params: CreateAuditLogParams): Promise<AuditLog> {
    const id = crypto.randomUUID().replace(/-/g, '').substring(0, 22);

    const row = await queryOne<AuditLogRow>(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, user_agent, status, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        params.userId || null,
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        params.ipAddress || null,
        params.userAgent || null,
        params.status,
        params.details ? JSON.stringify(params.details) : null,
      ]
    );

    return rowToAuditLog(row!);
  }

  /**
   * Get audit log by ID
   */
  async getById(id: string): Promise<AuditLog | undefined> {
    const row = await queryOne<AuditLogRow>(
      'SELECT * FROM audit_logs WHERE id = $1',
      [id]
    );
    return row ? rowToAuditLog(row) : undefined;
  }

  /**
   * Query audit logs with filters
   */
  async query(params: AuditLogQuery): Promise<{ logs: AuditLog[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(params.userId);
    }

    if (params.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(params.action);
    }

    if (params.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }

    if (params.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      values.push(params.startDate);
    }

    if (params.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      values.push(params.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      values
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get paginated results
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const rows = await query<AuditLogRow>(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset]
    );

    return {
      logs: rows.map(rowToAuditLog),
      total,
    };
  }

  /**
   * Get recent audit logs for a user
   */
  async getRecentByUser(userId: string, limit: number = 20): Promise<AuditLog[]> {
    const rows = await query<AuditLogRow>(
      `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [userId, limit]
    );
    return rows.map(rowToAuditLog);
  }

  /**
   * Get recent failed login attempts for an email (for security monitoring)
   */
  async getRecentFailedLogins(email: string, minutes: number = 15): Promise<number> {
    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs
       WHERE action = 'auth.login'
       AND status = 'failure'
       AND details->>'email' = $1
       AND timestamp > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'`,
      [email]
    );
    return parseInt(result?.count || '0', 10);
  }

  /**
   * Get actions by type for analytics
   */
  async getActionCounts(startDate: Date, endDate: Date): Promise<{ action: string; count: number }[]> {
    const rows = await query<{ action: string; count: string }>(
      `SELECT action, COUNT(*) as count FROM audit_logs
       WHERE timestamp >= $1 AND timestamp <= $2
       GROUP BY action ORDER BY count DESC`,
      [startDate, endDate]
    );
    return rows.map(row => ({ action: row.action, count: parseInt(row.count, 10) }));
  }
}

export const auditLogStore = new AuditLogStore();
