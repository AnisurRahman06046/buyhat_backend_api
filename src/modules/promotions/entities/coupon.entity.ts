import { Column, Entity, Index, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { CouponType } from '../enums/coupon-type.enum';
import { CouponCategory } from './coupon-category.entity';

/**
 * A discount code with abuse controls (edge #6): global + per-user usage limits,
 * an optional validity window, min-purchase / max-discount rules, and optional
 * category restriction. `used_count` is the authoritative global counter.
 */
@Entity({ schema: SCHEMA.PROMOTIONS, name: 'coupon' })
@Index(['isActive', 'startsAt', 'endsAt'])
export class Coupon extends SoftDeletableEntity {
  @Index('uq_coupon_code', { unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'promotion_id', type: 'uuid', nullable: true })
  promotionId: string | null;

  @Column({ type: 'varchar', length: 20 })
  type: CouponType;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  value: number;

  @Column({
    name: 'min_purchase_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    nullable: true,
  })
  minPurchaseAmount: number | null;

  @Column({
    name: 'max_discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    nullable: true,
  })
  maxDiscountAmount: number | null;

  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ name: 'usage_limit_per_user', type: 'int', nullable: true })
  usageLimitPerUser: number | null;

  @Column({ name: 'usage_limit_per_ip', type: 'int', nullable: true })
  usageLimitPerIp: number | null;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => CouponCategory, (link) => link.coupon)
  categories: CouponCategory[];
}
