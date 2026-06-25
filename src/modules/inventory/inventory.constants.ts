import { Role } from '../../common/enums/role.enum';

/** Roles allowed to perform stock operations (D17). */
export const INVENTORY_WRITE_ROLES = [
  Role.ADMIN,
  Role.INVENTORY_MANAGER,
] as const;

/** Delayed-job name for reservation expiry on the `inventory` queue. */
export const RESERVATION_EXPIRE_JOB = 'reservation.expire';

/** Best-effort recipient for low-stock alerts (formalized in Phase 10). */
export const LOW_STOCK_ALERT_EMAIL = 'inventory-alerts@buyhat.local';
