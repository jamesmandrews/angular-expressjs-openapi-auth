/**
 * Enforce Unique Canonical Email Plugin
 *
 * Prevents registration when the canonical form of an email already exists.
 * This blocks users from creating multiple accounts using email aliases.
 *
 * Examples of blocked duplicates:
 *   - john@gmail.com exists → john+test@gmail.com blocked
 *   - j.o.h.n@gmail.com exists → john@gmail.com blocked
 *   - user@gmail.com exists → user@googlemail.com blocked
 *
 * DISABLED BY DEFAULT - Enable by removing from DISABLED_PLUGINS
 *
 * Configuration:
 *   DISABLED_PLUGINS=enforce-unique-canonical-email  (to keep disabled)
 */

import { Plugin, PluginContext, PluginResult } from '../plugin-system/types';
import { userStore } from '../models/userStore';
import { canonicalizeEmail } from '../utils/email';
import logger from '../utils/logger';

const enforceUniqueCanonicalEmail: Plugin = {
  name: 'enforce-unique-canonical-email',
  version: '1.0.0',
  events: ['auth.register.before'],
  mode: 'sync',
  priority: 20, // Run after block-plus-aliases (priority 10)

  async handle(ctx: PluginContext): Promise<PluginResult> {
    const email = ctx.data.email as string;

    if (!email) {
      return { success: true };
    }

    // Check if canonical email already exists
    const exists = await userStore.canonicalEmailExists(email);

    if (exists) {
      const canonical = canonicalizeEmail(email.toLowerCase());
      logger.info(
        `[enforce-unique-canonical-email] Blocked registration: canonical email already exists`,
        { email, canonical }
      );

      return {
        success: false,
        error: 'An account with this email address already exists.',
        data: { code: 'EMAIL_EXISTS' },
      };
    }

    return { success: true };
  },

  async onLoad() {
    logger.info('[enforce-unique-canonical-email] Plugin loaded - enforcing unique canonical emails');
  },
};

export default enforceUniqueCanonicalEmail;
