/** DI token for the notification provider (swappable; Phase 10 replaces the stub). */
export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';

/**
 * Outbound messaging port. Phase 1 binds a logging stub; Phase 10 binds real
 * email/SMS/push adapters behind the same token — no caller changes.
 */
export interface NotificationProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendSms(to: string, message: string): Promise<void>;
}
