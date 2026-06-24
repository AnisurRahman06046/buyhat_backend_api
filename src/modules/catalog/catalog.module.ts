import { Module } from '@nestjs/common';

/**
 * Catalog module — products, categories, brands, attributes and variants.
 * Owns schema `catalog`. The read-heavy surface of the storefront; expected
 * to be cache-backed (Redis) and a prime candidate for later extraction.
 *
 * Skeleton only.
 */
@Module({})
export class CatalogModule {}
