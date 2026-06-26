import { Role } from '../../common/enums/role.enum';

/** Roles allowed to manage coupons, flash sales, and campaigns (D45). */
export const PROMOTIONS_WRITE_ROLES = [
  Role.ADMIN,
  Role.MARKETING_MANAGER,
] as const;

/** How often the flash-sale sweeper flips SCHEDULED→ACTIVE→ENDED. */
export const FLASH_SALE_SWEEP_INTERVAL_MS = 60_000;
