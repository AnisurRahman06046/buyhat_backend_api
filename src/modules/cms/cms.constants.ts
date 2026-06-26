import { Role } from '../../common/enums/role.enum';

/** Roles allowed to manage homepage, banners, popups, landing pages (D51). */
export const CMS_WRITE_ROLES = [Role.ADMIN, Role.MARKETING_MANAGER] as const;

/** Hard cap on a CMS image upload (bytes). */
export const CMS_MEDIA_UPLOAD_LIMIT_BYTES = 15 * 1024 * 1024;

/** Allowed image mime prefix for CMS uploads. */
export const CMS_ALLOWED_IMAGE_PREFIX = 'image/';
