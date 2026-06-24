import { Module } from '@nestjs/common';

/**
 * Orders module — checkout and the order lifecycle (placed → paid → fulfilled
 * → completed/cancelled). Owns schema `orders`. Orchestrates Cart, Inventory,
 * Payments and Promotions through their service layers.
 *
 * Skeleton only.
 */
@Module({})
export class OrdersModule {}
