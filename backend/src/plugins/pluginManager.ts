import { Plugin, PluginEvent, PluginContext, ALL_PLUGIN_EVENTS } from './types';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';

/**
 * Plugin Manager
 *
 * Handles loading, registering, and dispatching events to plugins.
 * Plugins are auto-discovered from the plugins directory on startup.
 */
class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private syncHandlers: Map<PluginEvent, Plugin[]> = new Map();
  private asyncHandlers: Map<PluginEvent, Plugin[]> = new Map();
  private loaded = false;

  /**
   * Load all plugins from a directory
   */
  async loadPlugins(pluginsDir: string): Promise<void> {
    if (this.loaded) {
      logger.warn('Plugins already loaded, skipping');
      return;
    }

    if (!fs.existsSync(pluginsDir)) {
      logger.info('No plugins directory found, skipping plugin loading');
      this.loaded = true;
      return;
    }

    const files = fs.readdirSync(pluginsDir).filter((f) => {
      // Load .ts files in development, .js files in production
      // Skip files starting with . (hidden files, .gitkeep)
      if (f.startsWith('.')) return false;
      return f.endsWith('.ts') || f.endsWith('.js');
    });

    if (files.length === 0) {
      logger.info('No plugins found in plugins directory');
      this.loaded = true;
      return;
    }

    logger.info(`Found ${files.length} plugin file(s) in ${pluginsDir}`);

    for (const file of files) {
      try {
        const pluginPath = path.join(pluginsDir, file);
        const module = await import(pluginPath);
        const plugin: Plugin = module.default || module;

        if (this.isValidPlugin(plugin)) {
          await this.register(plugin);
          logger.info(`Loaded plugin: ${plugin.name} (${plugin.mode} mode)`);
        } else {
          logger.warn(`Invalid plugin in ${file}: missing required fields (name, events, mode, handle)`);
        }
      } catch (err) {
        logger.error(`Failed to load plugin ${file}:`, err);
      }
    }

    this.loaded = true;
    logger.info(`Plugin loading complete. ${this.plugins.size} plugin(s) registered.`);
  }

  /**
   * Validate that an object is a valid Plugin
   */
  private isValidPlugin(plugin: unknown): plugin is Plugin {
    if (typeof plugin !== 'object' || plugin === null) return false;

    const p = plugin as Record<string, unknown>;
    return (
      typeof p.name === 'string' &&
      (p.events === '*' || Array.isArray(p.events)) &&
      (p.mode === 'sync' || p.mode === 'async') &&
      typeof p.handle === 'function'
    );
  }

  /**
   * Register a single plugin
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} already registered`);
    }

    // Call onLoad if provided
    if (plugin.onLoad) {
      try {
        await plugin.onLoad();
      } catch (err) {
        logger.error(`Plugin ${plugin.name} onLoad failed:`, err);
        throw err;
      }
    }

    this.plugins.set(plugin.name, plugin);

    // Determine which events this plugin handles
    const events: PluginEvent[] = plugin.events === '*' ? ALL_PLUGIN_EVENTS : plugin.events;

    // Add to appropriate handler map
    const handlerMap = plugin.mode === 'sync' ? this.syncHandlers : this.asyncHandlers;

    for (const event of events) {
      if (!handlerMap.has(event)) {
        handlerMap.set(event, []);
      }
      handlerMap.get(event)!.push(plugin);
    }

    // Sort sync handlers by priority (lower = runs first)
    if (plugin.mode === 'sync') {
      for (const handlers of this.syncHandlers.values()) {
        handlers.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
      }
    }
  }

  /**
   * Emit an event to all registered plugins
   *
   * Sync plugins run sequentially (blocking), async plugins fire-and-forget.
   */
  async emit(event: PluginEvent, ctx: Omit<PluginContext, 'event' | 'timestamp'>): Promise<void> {
    const fullCtx: PluginContext = {
      ...ctx,
      event,
      timestamp: new Date(),
    };

    // Run sync handlers sequentially (blocking)
    const syncPlugins = this.syncHandlers.get(event) || [];
    for (const plugin of syncPlugins) {
      try {
        const result = await plugin.handle(fullCtx);
        if (!result.success) {
          logger.warn(`Sync plugin ${plugin.name} returned failure for ${event}: ${result.error}`);
        }
      } catch (err) {
        logger.error(`Sync plugin ${plugin.name} threw error on ${event}:`, err);
        // Continue to next plugin even on error
      }
    }

    // Fire async handlers (non-blocking)
    const asyncPlugins = this.asyncHandlers.get(event) || [];
    for (const plugin of asyncPlugins) {
      // Don't await - fire and forget
      plugin.handle(fullCtx).catch((err) => {
        logger.error(`Async plugin ${plugin.name} error on ${event}:`, err);
      });
    }
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if plugins have been loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
