/**
 * Public API of the `notifications` module. Callers inject `NotificationService`
 * (the module is @Global) and dispatch via the `NotificationEvent` registry.
 */
export { NotificationsModule } from './notifications.module';
export { NotificationService } from './services/notification.service';
export type {
  DispatchInput,
  NotificationRecipient,
} from './services/notification.service';
export { NotificationEvent } from './events/notification-events';
export { NotificationChannel } from './enums/notification-channel.enum';
export { NotificationCategory } from './enums/notification-category.enum';
export { NotificationStatus } from './enums/notification-status.enum';
