export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  /**
   * Send an email message
   */
  send(message: EmailMessage): Promise<SendResult>;

  /**
   * Get the provider name for logging
   */
  getName(): string;
}
