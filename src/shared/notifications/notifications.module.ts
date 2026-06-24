import { Global, Module } from '@nestjs/common';
import { LoggingNotificationProvider } from './logging-notification.provider';
import { NOTIFICATION_PROVIDER } from './notification.types';

/**
 * Global notification infrastructure. Binds the swappable {@link NOTIFICATION_PROVIDER}
 * token to the Phase 1 logging stub; inject the token anywhere to send messages.
 */
@Global()
@Module({
  providers: [
    { provide: NOTIFICATION_PROVIDER, useClass: LoggingNotificationProvider },
  ],
  exports: [NOTIFICATION_PROVIDER],
})
export class NotificationsModule {}
