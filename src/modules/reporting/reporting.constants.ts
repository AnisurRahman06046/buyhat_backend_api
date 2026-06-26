import { Role } from '../../common/enums/role.enum';

/** Roles allowed to view reports + the audit log (D68). */
export const REPORTS_VIEW_ROLES = [Role.ADMIN] as const;

/** Default best/worst-seller page size. */
export const DEFAULT_SELLER_LIMIT = 20;

/** Default best-sellers fed to CMS sections. */
export const DEFAULT_BEST_SELLERS_LIMIT = 10;
