/**
 * Plugin Event Types
 *
 * All events that can trigger plugin execution.
 */
export type PluginEvent =
  // Auth events
  | 'auth.register.before'
  | 'auth.register'
  | 'auth.login'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'auth.logout.all'
  // Password events
  | 'auth.password.reset.request'
  | 'auth.password.reset'
  | 'auth.password.change'
  // Email events
  | 'auth.email.verified'
  | 'auth.email.resend'
  // 2FA events
  | 'auth.2fa.enabled'
  | 'auth.2fa.disabled'
  | 'auth.2fa.verify'
  | 'auth.2fa.verify.failed'
  | 'auth.2fa.backup.used'
  | 'auth.2fa.backup.regenerated'
  // Profile events
  | 'user.profile.updated'
  // Organization events
  | 'org.created'
  | 'org.updated'
  | 'org.member.invited'
  | 'org.member.joined'
  | 'org.member.updated'
  | 'org.member.removed';

/**
 * Context passed to plugin handlers
 */
export interface PluginContext {
  /** The event that triggered this handler */
  event: PluginEvent;
  /** User ID if available */
  userId?: string;
  /** User email if available */
  email?: string;
  /** Client IP address */
  ip?: string;
  /** Client user agent */
  userAgent?: string;
  /** When the event occurred */
  timestamp: Date;
  /** Event-specific data */
  data: Record<string, unknown>;
}

/**
 * Result returned by plugin handlers
 */
export interface PluginResult {
  /** Whether the handler succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Optional data to return */
  data?: Record<string, unknown>;
}

/**
 * Plugin interface
 *
 * Plugins must implement this interface to be loaded by the plugin manager.
 */
export interface Plugin {
  /** Unique plugin name */
  name: string;
  /** Plugin version (optional) */
  version?: string;
  /** Events this plugin handles ('*' for all events) */
  events: PluginEvent[] | '*';
  /** Execution mode: 'sync' blocks response, 'async' is fire-and-forget */
  mode: 'sync' | 'async';
  /** Priority for sync plugins (lower runs first, default 100) */
  priority?: number;
  /** Handler function called for each event */
  handle(ctx: PluginContext): Promise<PluginResult>;
  /** Called when plugin is loaded (optional) */
  onLoad?(): Promise<void>;
  /** Called when plugin is unloaded (optional) */
  onUnload?(): Promise<void>;
}

/**
 * All available plugin event types
 */
export const ALL_PLUGIN_EVENTS: PluginEvent[] = [
  'auth.register.before',
  'auth.register',
  'auth.login',
  'auth.login.failed',
  'auth.logout',
  'auth.logout.all',
  'auth.password.reset.request',
  'auth.password.reset',
  'auth.password.change',
  'auth.email.verified',
  'auth.email.resend',
  'auth.2fa.enabled',
  'auth.2fa.disabled',
  'auth.2fa.verify',
  'auth.2fa.verify.failed',
  'auth.2fa.backup.used',
  'auth.2fa.backup.regenerated',
  'user.profile.updated',
  'org.created',
  'org.updated',
  'org.member.invited',
  'org.member.joined',
  'org.member.updated',
  'org.member.removed',
];
