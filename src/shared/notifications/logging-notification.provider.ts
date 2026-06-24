import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider } from './notification.types';

/**
 * Phase 1 stub: logs messages instead of sending them, so the email/SMS-driven
 * flows (verification, password reset, OTP) are exercisable end-to-end without a
 * real provider. Replaced by real adapters in Phase 10 (notifications module).
 */
@Injectable()
export class LoggingNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('Notifications');

  sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`EMAIL → ${to} | ${subject} | ${body}`);
    return Promise.resolve();
  }

  sendSms(to: string, message: string): Promise<void> {
    this.logger.log(`SMS → ${to} | ${message}`);
    return Promise.resolve();
  }
}
