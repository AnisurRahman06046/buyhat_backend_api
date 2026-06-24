import { Module } from '@nestjs/common';

/**
 * Inventory module — stock levels, reservations and adjustments per variant.
 * Owns schema `inventory`. Reservation/commit operations are the integrity
 * boundary that prevents overselling during checkout.
 *
 * Skeleton only.
 */
@Module({})
export class InventoryModule {}
