import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider } from './notification.types';

/**
 * Default adapter: logs messages instead of sending them, so every notification
 * flow (verification, password reset, order events, low-stock, abandoned cart)
 * is exercisable end-to-end without real provider credentials — mirroring the
 * payments MOCK gateway. Swap in real SMTP/Twilio/FCM adapters behind
 * {@link NOTIFICATION_PROVIDER} in production with no caller changes.
 */
@Injectable()
export class LoggingNotificationProvider implements NotificationProvider {
  readonly name = 'logging';
  private readonly logger = new Logger('Notifications');

  sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`EMAIL → ${to} | ${subject} | ${body}`);
    return Promise.resolve();
  }

  sendSms(to: string, message: string): Promise<void> {
    this.logger.log(`SMS → ${to} | ${message}`);
    return Promise.resolve();
  }

  sendPush(to: string, title: string, body: string): Promise<void> {
    this.logger.log(`PUSH → ${to} | ${title} | ${body}`);
    return Promise.resolve();
  }
}
