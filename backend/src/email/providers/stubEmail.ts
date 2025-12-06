import { EmailProvider, EmailMessage, SendResult } from '../emailProvider';
import logger from '../../utils/logger';
import crypto from 'crypto';

/**
 * Stub email provider for development/testing
 * Logs emails to console instead of sending them
 */
export class StubEmailProvider implements EmailProvider {
  getName(): string {
    return 'stub';
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const messageId = crypto.randomUUID();

    logger.info('=== STUB EMAIL (not sent) ===');
    logger.info(`To: ${message.to}`);
    logger.info(`Subject: ${message.subject}`);
    if (message.text) {
      logger.info(`Body (text): ${message.text}`);
    }
    if (message.html) {
      logger.info(`Body (html): ${message.html.substring(0, 200)}...`);
    }
    logger.info(`Message ID: ${messageId}`);
    logger.info('=== END STUB EMAIL ===');

    return {
      success: true,
      messageId,
    };
  }
}
