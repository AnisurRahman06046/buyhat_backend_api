import { Role } from '../../common/enums/role.enum';
import { QUEUE_NAMES } from '../../shared/queue/queue.constants';

/** Manual send + template editing (D65). */
export const NOTIFICATIONS_ADMIN_ROLES = [
  Role.ADMIN,
  Role.MARKETING_MANAGER,
] as const;

/** Delivery-log viewing — adds CUSTOMER_SUPPORT to the admin roles (D65). */
export const NOTIFICATIONS_VIEW_ROLES = [
  Role.ADMIN,
  Role.MARKETING_MANAGER,
  Role.CUSTOMER_SUPPORT,
] as const;

/** BullMQ queue carrying `{ notificationId }` delivery jobs. */
export const NOTIFICATIONS_QUEUE = QUEUE_NAMES.NOTIFICATIONS;

/** Single job name on the notifications queue. */
export const NOTIFICATION_SEND_JOB = 'send';

/** Separator for the public composite template id `event::channel`. */
export const TEMPLATE_ID_SEPARATOR = '::';
