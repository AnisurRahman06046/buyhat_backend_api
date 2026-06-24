import { Module } from '@nestjs/common';

/**
 * CMS module — merchandising content: homepage layouts, banners and popups.
 * Owns schema `cms`. Media assets are stored via the STORAGE_PROVIDER port,
 * keeping binaries out of Postgres.
 *
 * Skeleton only.
 */
@Module({})
export class CmsModule {}
