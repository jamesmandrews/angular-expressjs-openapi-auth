/**
 * Example Logger Plugin
 *
 * This plugin logs all authentication events to the console.
 * It demonstrates how to create a plugin that listens to all events.
 *
 * To disable this plugin, rename or delete this file.
 */
import { Plugin, PluginContext, PluginResult } from '../plugin-system/types';

const exampleLogger: Plugin = {
  name: 'example-logger',
  version: '1.0.0',
  events: '*', // Listen to all events
  mode: 'async', // Non-blocking (fire and forget)

  async handle(ctx: PluginContext): Promise<PluginResult> {
    // Format the log message
    const logData = {
      event: ctx.event,
      userId: ctx.userId || 'anonymous',
      email: ctx.email || 'N/A',
      ip: ctx.ip || 'unknown',
      timestamp: ctx.timestamp.toISOString(),
      data: ctx.data,
    };

    console.log(`[PLUGIN:example-logger] ${ctx.event}`, JSON.stringify(logData, null, 2));

    return { success: true };
  },

  async onLoad(): Promise<void> {
    console.log('[PLUGIN:example-logger] Plugin loaded - will log all auth events');
  },
};

export default exampleLogger;
