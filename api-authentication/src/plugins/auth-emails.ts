/**
 * Auth Emails Plugin
 *
 * Handles sending authentication-related emails (verification, password reset)
 * in response to auth events. This plugin runs in async mode so email sending
 * doesn't block the API response.
 *
 * Events handled:
 * - auth.register: Sends email verification link
 * - auth.password.reset.request: Sends password reset link
 * - auth.email.resend: Resends email verification link
 */

import { Plugin, PluginContext, PluginResult } from '../plugin-system/types';
import { getEmailProvider } from '../email';
import logger from '../utils/logger';

const authEmails: Plugin = {
  name: 'auth-emails',
  version: '1.0.0',
  events: ['auth.register', 'auth.password.reset.request', 'auth.email.resend'],
  mode: 'async',

  async handle(ctx: PluginContext): Promise<PluginResult> {
    const emailProvider = getEmailProvider();

    switch (ctx.event) {
      case 'auth.register': {
        const { email, verificationUrl } = ctx.data as { email: string; verificationUrl: string };

        if (!email || !verificationUrl) {
          logger.warn('[auth-emails] Missing email or verificationUrl for auth.register event');
          return { success: false, error: 'Missing required data' };
        }

        const result = await emailProvider.send({
          to: email,
          subject: 'Verify Your Email Address',
          text: `Welcome! Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.`,
          html: `
            <h2>Welcome!</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not create an account, please ignore this email.</p>
          `,
        });

        if (!result.success) {
          logger.error(`[auth-emails] Failed to send verification email to ${email}`, { error: result.error });
          return { success: false, error: result.error };
        }

        logger.info(`[auth-emails] Verification email sent to ${email}`);
        return { success: true };
      }

      case 'auth.password.reset.request': {
        const { email, resetUrl } = ctx.data as { email: string; resetUrl: string };

        if (!email || !resetUrl) {
          logger.warn('[auth-emails] Missing email or resetUrl for auth.password.reset.request event');
          return { success: false, error: 'Missing required data' };
        }

        const result = await emailProvider.send({
          to: email,
          subject: 'Password Reset Request',
          text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`,
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this, please ignore this email.</p>
          `,
        });

        if (!result.success) {
          logger.error(`[auth-emails] Failed to send password reset email to ${email}`, { error: result.error });
          return { success: false, error: result.error };
        }

        logger.info(`[auth-emails] Password reset email sent to ${email}`);
        return { success: true };
      }

      case 'auth.email.resend': {
        const { email, verificationUrl } = ctx.data as { email: string; verificationUrl: string };

        if (!email || !verificationUrl) {
          logger.warn('[auth-emails] Missing email or verificationUrl for auth.email.resend event');
          return { success: false, error: 'Missing required data' };
        }

        const result = await emailProvider.send({
          to: email,
          subject: 'Verify Your Email Address',
          text: `Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not request this, please ignore this email.`,
          html: `
            <h2>Email Verification</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not request this, please ignore this email.</p>
          `,
        });

        if (!result.success) {
          logger.error(`[auth-emails] Failed to send verification email to ${email}`, { error: result.error });
          return { success: false, error: result.error };
        }

        logger.info(`[auth-emails] Verification email resent to ${email}`);
        return { success: true };
      }

      default:
        return { success: true };
    }
  },

  async onLoad() {
    logger.info('[auth-emails] Plugin loaded - handling verification and password reset emails');
  },
};

export default authEmails;
