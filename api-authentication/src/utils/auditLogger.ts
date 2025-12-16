import { Request } from 'express';
import { auditLogStore, CreateAuditLogParams, AuditLog } from '../models/auditLogStore';
import logger from './logger';

/**
 * Audit event types for type safety
 */
export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_reset_request'
  | 'auth.password_reset'
  | 'auth.password_change'
  | 'auth.email_verified'
  | 'auth.2fa_enabled'
  | 'auth.2fa_disabled'
  | 'auth.2fa_verify'
  | 'auth.backup_code_used'
  | 'user.profile_updated'
  | 'user.role_assigned'
  | 'user.role_removed';

export type AuditStatus = 'success' | 'failure' | 'blocked';

export interface AuditEventParams {
  action: AuditAction;
  userId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  status: AuditStatus;
  details?: Record<string, unknown>;
}

/**
 * Check if audit logging is enabled
 */
function isAuditEnabled(): boolean {
  const enabled = process.env.AUDIT_LOG_ENABLED;
  return enabled === undefined || enabled === 'true' || enabled === '1';
}

/**
 * Extract client IP from request
 */
function getClientIp(req: Request): string | null {
  // Check for forwarded IP (if behind proxy)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }

  // Check for real IP header (nginx)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket address
  return req.socket?.remoteAddress || null;
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  if (!ua) return null;
  // Truncate to 500 chars to match DB column
  return ua.length > 500 ? ua.substring(0, 500) : ua;
}

/**
 * Log an audit event
 *
 * @example
 * // Successful login
 * await auditLog(req, {
 *   action: 'auth.login',
 *   userId: user.id,
 *   status: 'success',
 *   details: { email: user.email }
 * });
 *
 * @example
 * // Failed login attempt
 * await auditLog(req, {
 *   action: 'auth.login',
 *   status: 'failure',
 *   details: { email, reason: 'invalid_password' }
 * });
 */
export async function auditLog(req: Request, params: AuditEventParams): Promise<AuditLog | null> {
  if (!isAuditEnabled()) {
    return null;
  }

  try {
    const createParams: CreateAuditLogParams = {
      userId: params.userId || req.user?.id || null,
      action: params.action,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      status: params.status,
      details: params.details || null,
    };

    const log = await auditLogStore.create(createParams);

    // Also log to application logger for immediate visibility
    const logLevel = params.status === 'failure' || params.status === 'blocked' ? 'warn' : 'info';
    logger[logLevel](`Audit: ${params.action} [${params.status}]`, {
      userId: createParams.userId,
      ip: createParams.ipAddress,
      details: params.details,
    });

    return log;
  } catch (error) {
    // Don't let audit logging failures break the application
    logger.error('Failed to create audit log', { error, params });
    return null;
  }
}

/**
 * Convenience functions for common audit events
 */
export const audit = {
  loginSuccess: (req: Request, userId: string, email: string) =>
    auditLog(req, {
      action: 'auth.login',
      userId,
      status: 'success',
      details: { email },
    }),

  loginFailure: (req: Request, email: string, reason: string) =>
    auditLog(req, {
      action: 'auth.login',
      status: 'failure',
      details: { email, reason },
    }),

  logout: (req: Request, userId: string) =>
    auditLog(req, {
      action: 'auth.logout',
      userId,
      status: 'success',
    }),

  register: (req: Request, userId: string, email: string, userType?: string) =>
    auditLog(req, {
      action: 'auth.register',
      userId,
      status: 'success',
      details: { email, userType },
    }),

  passwordResetRequest: (req: Request, email: string) =>
    auditLog(req, {
      action: 'auth.password_reset_request',
      status: 'success',
      details: { email },
    }),

  passwordReset: (req: Request, userId: string) =>
    auditLog(req, {
      action: 'auth.password_reset',
      userId,
      status: 'success',
    }),

  passwordChange: (req: Request, userId: string) =>
    auditLog(req, {
      action: 'auth.password_change',
      userId,
      status: 'success',
    }),

  emailVerified: (req: Request, userId: string) =>
    auditLog(req, {
      action: 'auth.email_verified',
      userId,
      status: 'success',
    }),

  profileUpdated: (req: Request, userId: string, fields: string[]) =>
    auditLog(req, {
      action: 'user.profile_updated',
      userId,
      status: 'success',
      details: { fields },
    }),

  twoFactorEnabled: (req: Request, userId: string) =>
    auditLog(req, {
      action: 'auth.2fa_enabled',
      userId,
      status: 'success',
    }),

  twoFactorDisabled: (req: Request, userId: string) =>
    auditLog(req, {
      action: 'auth.2fa_disabled',
      userId,
      status: 'success',
    }),

  twoFactorVerify: (req: Request, userId: string, success: boolean, method: 'totp' | 'backup_code') =>
    auditLog(req, {
      action: 'auth.2fa_verify',
      userId,
      status: success ? 'success' : 'failure',
      details: { method },
    }),

  backupCodeUsed: (req: Request, userId: string, codesRemaining: number) =>
    auditLog(req, {
      action: 'auth.backup_code_used',
      userId,
      status: 'success',
      details: { codesRemaining },
    }),

  roleAssigned: (req: Request, userId: string, role: string, assignedBy?: string) =>
    auditLog(req, {
      action: 'user.role_assigned',
      userId,
      resourceType: 'role',
      status: 'success',
      details: { role, assignedBy },
    }),

  roleRemoved: (req: Request, userId: string, role: string, removedBy?: string) =>
    auditLog(req, {
      action: 'user.role_removed',
      userId,
      resourceType: 'role',
      status: 'success',
      details: { role, removedBy },
    }),
};
