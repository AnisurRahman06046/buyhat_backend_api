import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { Coupon } from './coupon.entity';

/**
 * Append-only record of a coupon use, written at payment success. The unique
 * `(coupon_id, order_id)` index makes redemption idempotent; `user_id` + `ip`
 * back the per-user / per-IP abuse limits (edge #6).
 */
@Entity({ schema: SCHEMA.PROMOTIONS, name: 'coupon_redemption' })
@Index(['couponId', 'userId'])
@Index('uq_redemption_coupon_order', ['couponId', 'orderId'], { unique: true })
export class CouponRedemption extends BaseEntity {
  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId: string;

  @ManyToOne(() => Coupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  discountAmount: number;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;
}
