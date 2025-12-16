import { Request } from 'express';
import { pluginManager, PluginEvent, EmitBlockingResult } from '../plugin-system';
import { getClientIp, getUserAgent } from './cookies';

/**
 * Emit an event to all registered plugins
 *
 * @param event - The event type to emit
 * @param req - Express request object (for extracting IP, user agent, user ID)
 * @param data - Event-specific data to pass to plugins
 */
export async function emitEvent(
  event: PluginEvent,
  req: Request,
  data: Record<string, unknown> = {}
): Promise<void> {
  await pluginManager.emit(event, {
    userId: req.user?.id || (data.userId as string | undefined),
    email: data.email as string | undefined,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    data,
  });
}

/**
 * Emit a blocking event that can be stopped by sync plugins
 *
 * Use this for "before" events where plugins can prevent the operation.
 *
 * @param event - The event type to emit
 * @param req - Express request object
 * @param data - Event-specific data to pass to plugins
 * @returns Result indicating if any plugin blocked the operation
 */
export async function emitBlockingEvent(
  event: PluginEvent,
  req: Request,
  data: Record<string, unknown> = {}
): Promise<EmitBlockingResult> {
  return pluginManager.emitBlocking(event, {
    userId: req.user?.id || (data.userId as string | undefined),
    email: data.email as string | undefined,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    data,
  });
}

// Re-export types for convenience
export { PluginEvent, EmitBlockingResult } from '../plugin-system';
