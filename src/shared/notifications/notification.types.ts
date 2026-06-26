/** DI token for the notification provider (swappable adapter, like STORAGE_PROVIDER). */
export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';

/**
 * Outbound messaging port — the low-level channel adapter. Phase 1 bound a
 * logging stub; Phase 10 keeps the same port (default still the logging stub)
 * but the notifications feature module orchestrates templates, preferences,
 * retries and a delivery log on top of it. Real SMTP / Twilio / FCM adapters
 * drop in behind this token with no caller change.
 */
export interface NotificationProvider {
  /** Stable provider name recorded on the delivery log (e.g. `logging`, `smtp`). */
  readonly name: string;
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendSms(to: string, message: string): Promise<void>;
  sendPush(to: string, title: string, body: string): Promise<void>;
}
