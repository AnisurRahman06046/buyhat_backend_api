import { Role } from '../../common/enums/role.enum';

/** Staff allowed to issue refunds, capture COD, and read any order's payments (D39). */
export const PAYMENTS_STAFF_ROLES = [
  Role.ADMIN,
  Role.CUSTOMER_SUPPORT,
] as const;
