import { Global, Module } from '@nestjs/common';
import { LoggingNotificationProvider } from './logging-notification.provider';
import { NOTIFICATION_PROVIDER } from './notification.types';

/**
 * Global notification *adapter* infrastructure. Binds the swappable
 * {@link NOTIFICATION_PROVIDER} token to the default logging stub — the
 * low-level channel sender. The notifications feature module
 * (`src/modules/notifications`) builds templates / preferences / retries /
 * delivery-log on top of this port and is what callers inject.
 */
@Global()
@Module({
  providers: [
    { provide: NOTIFICATION_PROVIDER, useClass: LoggingNotificationProvider },
  ],
  exports: [NOTIFICATION_PROVIDER],
})
export class NotificationProviderModule {}
