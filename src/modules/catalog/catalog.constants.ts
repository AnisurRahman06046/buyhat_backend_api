import { Role } from '../../common/enums/role.enum';

/** Roles allowed to manage catalog data (D12). */
export const CATALOG_WRITE_ROLES = [
  Role.ADMIN,
  Role.MARKETING_MANAGER,
] as const;

/**
 * Hard ceiling for the multer file-size limit on media uploads. The effective
 * limit is `min(this, STORAGE_MAX_FILE_MB)` — this static value caps the
 * interceptor (decorators can't read config), config narrows it at runtime.
 */
export const MEDIA_UPLOAD_HARD_LIMIT_BYTES = 25 * 1024 * 1024;

/** Accepted MIME prefixes for product media. */
export const ALLOWED_MEDIA_MIME_PREFIXES = ['image/', 'video/'] as const;
