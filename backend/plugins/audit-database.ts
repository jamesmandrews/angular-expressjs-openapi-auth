/**
 * Audit Database Plugin
 *
 * Writes authentication events to the audit_logs database table.
 * This plugin replaces the direct audit.* calls in controllers with
 * event-driven audit logging.
 *
 * Events handled:
 * - auth.register → auth.register
 * - auth.login → auth.login (success)
 * - auth.login.failed → auth.login (failure)
 * - auth.logout → auth.logout
 * - auth.logout.all → auth.logout
 * - auth.password.reset.request → auth.password_reset_request
 * - auth.password.reset → auth.password_reset
 * - auth.password.change → auth.password_change
 * - auth.email.verified → auth.email_verified
 * - auth.2fa.enabled → auth.2fa_enabled
 * - auth.2fa.disabled → auth.2fa_disabled
 * - auth.2fa.verify → auth.2fa_verify
 * - auth.2fa.backup.used → auth.backup_code_used
 * - auth.2fa.backup.regenerated → auth.backup_code_used (regenerated)
 * - user.profile.updated → user.profile_updated
 *
 * Skipped events (no audit needed):
 * - auth.email.resend (just triggers email, not a security event)
 */

import { Plugin, PluginContext, PluginResult, PluginEvent } from '../src/plugins/types';
import { auditLogStore, CreateAuditLogParams } from '../src/models/auditLogStore';
import logger from '../src/utils/logger';

type AuditAction =
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
  | 'user.profile_updated';

type AuditStatus = 'success' | 'failure' | 'blocked';

interface AuditMapping {
  action: AuditAction;
  status: AuditStatus | ((ctx: PluginContext) => AuditStatus);
  details?: (ctx: PluginContext) => Record<string, unknown> | null;
}

// Map plugin events to audit actions
const eventToAuditMapping: Partial<Record<PluginEvent, AuditMapping>> = {
  'auth.register': {
    action: 'auth.register',
    status: 'success',
    details: (ctx) => ({
      email: ctx.data.email,
      userType: ctx.data.userType,
    }),
  },
  'auth.login': {
    action: 'auth.login',
    status: 'success',
    details: (ctx) => ({
      email: ctx.data.email,
      twoFactorRequired: ctx.data.twoFactorRequired,
    }),
  },
  'auth.login.failed': {
    action: 'auth.login',
    status: 'failure',
    details: (ctx) => ({
      email: ctx.data.email,
      reason: ctx.data.reason,
    }),
  },
  'auth.logout': {
    action: 'auth.logout',
    status: 'success',
  },
  'auth.logout.all': {
    action: 'auth.logout',
    status: 'success',
    details: (ctx) => ({
      sessionsRevoked: ctx.data.sessionsRevoked,
      allDevices: true,
    }),
  },
  'auth.password.reset.request': {
    action: 'auth.password_reset_request',
    status: 'success',
    details: (ctx) => ({
      email: ctx.data.email,
    }),
  },
  'auth.password.reset': {
    action: 'auth.password_reset',
    status: 'success',
  },
  'auth.password.change': {
    action: 'auth.password_change',
    status: 'success',
  },
  'auth.email.verified': {
    action: 'auth.email_verified',
    status: 'success',
  },
  'auth.2fa.enabled': {
    action: 'auth.2fa_enabled',
    status: 'success',
  },
  'auth.2fa.disabled': {
    action: 'auth.2fa_disabled',
    status: 'success',
  },
  'auth.2fa.verify': {
    action: 'auth.2fa_verify',
    status: 'success',
    details: (ctx) => ({
      method: ctx.data.method,
    }),
  },
  'auth.2fa.verify.failed': {
    action: 'auth.2fa_verify',
    status: 'failure',
    details: (ctx) => ({
      method: ctx.data.method,
    }),
  },
  'auth.2fa.backup.used': {
    action: 'auth.backup_code_used',
    status: 'success',
    details: (ctx) => ({
      codesRemaining: ctx.data.remainingCodes,
    }),
  },
  'auth.2fa.backup.regenerated': {
    action: 'auth.backup_code_used',
    status: 'success',
    details: () => ({
      regenerated: true,
    }),
  },
  'user.profile.updated': {
    action: 'user.profile_updated',
    status: 'success',
    details: (ctx) => ({
      fields: ctx.data.updatedFields,
    }),
  },
};

// Events to skip (no audit needed)
const skipEvents: PluginEvent[] = ['auth.email.resend'];

/**
 * Check if audit logging is enabled
 */
function isAuditEnabled(): boolean {
  const enabled = process.env.AUDIT_LOG_ENABLED;
  return enabled === undefined || enabled === 'true' || enabled === '1';
}

const auditDatabase: Plugin = {
  name: 'audit-database',
  version: '1.0.0',
  events: '*',
  mode: 'async',

  async handle(ctx: PluginContext): Promise<PluginResult> {
    // Check if audit logging is enabled
    if (!isAuditEnabled()) {
      return { success: true };
    }

    // Skip events that don't need auditing
    if (skipEvents.includes(ctx.event)) {
      return { success: true };
    }

    // Get mapping for this event
    const mapping = eventToAuditMapping[ctx.event];
    if (!mapping) {
      // Unknown event - log but don't fail
      logger.debug(`[audit-database] No audit mapping for event: ${ctx.event}`);
      return { success: true };
    }

    try {
      // Determine status
      const status = typeof mapping.status === 'function'
        ? mapping.status(ctx)
        : mapping.status;

      // Get details
      const details = mapping.details ? mapping.details(ctx) : null;

      // Create audit log params
      const params: CreateAuditLogParams = {
        userId: ctx.userId || null,
        action: mapping.action,
        ipAddress: ctx.ip || null,
        userAgent: ctx.userAgent || null,
        status,
        details,
      };

      // Write to database
      await auditLogStore.create(params);

      // Also log to application logger for immediate visibility
      const logLevel = status === 'failure' || status === 'blocked' ? 'warn' : 'info';
      logger[logLevel](`Audit: ${mapping.action} [${status}]`, {
        userId: params.userId,
        ip: params.ipAddress,
        details,
      });

      return { success: true };
    } catch (error) {
      // Don't let audit logging failures break the application
      logger.error('[audit-database] Failed to create audit log', {
        error,
        event: ctx.event,
        userId: ctx.userId,
      });
      return { success: false, error: String(error) };
    }
  },

  async onLoad() {
    const enabled = isAuditEnabled();
    logger.info(`[audit-database] Plugin loaded - audit logging ${enabled ? 'enabled' : 'disabled'}`);
  },
};

export default auditDatabase;
