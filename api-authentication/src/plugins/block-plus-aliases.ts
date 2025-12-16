/**
 * Block Plus Aliases Plugin
 *
 * Prevents registration with email plus-addressing (e.g., user+alias@gmail.com).
 * This is useful to prevent users from creating multiple accounts with the same
 * base email address.
 *
 * DISABLED BY DEFAULT - Add to DISABLED_PLUGINS to keep disabled, or remove to enable.
 *
 * Configuration:
 *   DISABLED_PLUGINS=block-plus-aliases  (to disable)
 *
 * Example blocked emails:
 *   - thenetimp+test@gmail.com
 *   - user+signup@example.com
 *   - admin+1@company.org
 */

import { Plugin, PluginContext, PluginResult } from '../plugin-system/types';
import logger from '../utils/logger';

/**
 * Regex to detect plus-addressing in emails
 * Matches: localpart+something@domain
 */
const PLUS_ALIAS_REGEX = /^[^@]+\+[^@]+@[^@]+$/;

const blockPlusAliases: Plugin = {
  name: 'block-plus-aliases',
  version: '1.0.0',
  events: ['auth.register.before'],
  mode: 'sync',
  priority: 10, // Run early to block before other checks

  async handle(ctx: PluginContext): Promise<PluginResult> {
    const email = ctx.data.email as string;

    if (!email) {
      return { success: true };
    }

    // Check if email contains plus-addressing
    if (PLUS_ALIAS_REGEX.test(email)) {
      logger.info(`[block-plus-aliases] Blocked registration attempt with plus-alias: ${email}`);

      return {
        success: false,
        error: 'Email addresses with plus signs (+) are not allowed. Please use your primary email address.',
        data: { code: 'PLUS_ALIAS_NOT_ALLOWED' },
      };
    }

    return { success: true };
  },

  async onLoad() {
    logger.info('[block-plus-aliases] Plugin loaded - blocking plus-alias email registrations');
  },
};

export default blockPlusAliases;
