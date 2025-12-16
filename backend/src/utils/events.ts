import { Request } from 'express';
import { pluginManager, PluginEvent } from '../plugins';
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

// Re-export types for convenience
export { PluginEvent } from '../plugins';
