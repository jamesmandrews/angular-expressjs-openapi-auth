import nodemailer from 'nodemailer';
import { EmailProvider, EmailMessage, SendResult } from '../emailProvider';
import logger from '../../utils/logger';

/**
 * SMTP email provider using Nodemailer
 */
export class SmtpEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;
  private fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.fromAddress = process.env.SMTP_FROM || 'noreply@example.com';

    if (!host) {
      throw new Error('SMTP_HOST environment variable is required for SMTP email provider');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    logger.info(`SMTP email provider configured for ${host}:${port}`);
  }

  getName(): string {
    return 'smtp';
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      logger.debug(`Email sent to ${message.to}`, { messageId: info.messageId });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send email to ${message.to}`, { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
