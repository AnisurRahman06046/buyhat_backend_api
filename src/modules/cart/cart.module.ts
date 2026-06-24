import { Module } from '@nestjs/common';

/**
 * Cart module — shopping carts and their line items. Owns schema `cart`.
 * Prices/availability are resolved through Catalog and Inventory services,
 * never by cross-schema joins.
 *
 * Skeleton only.
 */
@Module({})
export class CartModule {}
