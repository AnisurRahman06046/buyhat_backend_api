import { Module } from '@nestjs/common';

/**
 * Promotions module — coupons, discount rules and campaign eligibility.
 * Owns schema `promotions`. Orders calls PromotionsService to validate and
 * apply discounts at checkout.
 *
 * Skeleton only.
 */
@Module({})
export class PromotionsModule {}
