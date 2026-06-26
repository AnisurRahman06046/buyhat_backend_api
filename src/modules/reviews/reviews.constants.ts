import { Role } from '../../common/enums/role.enum';

/** Roles allowed to moderate (approve/reject/delete-any) reviews (D55). */
export const REVIEWS_MODERATE_ROLES = [
  Role.ADMIN,
  Role.CUSTOMER_SUPPORT,
] as const;
