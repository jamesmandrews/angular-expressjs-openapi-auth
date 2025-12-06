import { EmailProvider } from './emailProvider';
import { StubEmailProvider } from './providers/stubEmail';
import { SmtpEmailProvider } from './providers/smtpEmail';
import logger from '../utils/logger';

export * from './emailProvider';

let emailProvider: EmailProvider | null = null;

/**
 * Get the configured email provider based on EMAIL_PROVIDER env var.
 * Defaults to 'stub' which logs emails instead of sending them.
 */
export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    const providerType = process.env.EMAIL_PROVIDER || 'stub';

    switch (providerType.toLowerCase()) {
      case 'smtp':
        emailProvider = new SmtpEmailProvider();
        break;
      case 'stub':
      default:
        emailProvider = new StubEmailProvider();
        break;
    }

    logger.info(`Using ${emailProvider.getName()} email provider`);
  }

  return emailProvider;
}

/**
 * Reset the email provider (useful for testing)
 */
export function resetEmailProvider(): void {
  emailProvider = null;
}
