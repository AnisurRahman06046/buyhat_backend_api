import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';

/**
 * Denormalized per-order revenue fact (read model). One row per order, keyed
 * unique by `order_id`; inserted when the order first commits and updated on
 * later status changes. Fed only by `ReportingService` seams — never by reading
 * the orders schema. Money via {@link moneyTransformer}; enums as varchar.
 */
@Entity({ schema: SCHEMA.REPORTING, name: 'order_fact' })
@Index('uq_order_fact_order', ['orderId'], { unique: true })
@Index('idx_order_fact_committed', ['committedAt'])
export class OrderFact extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 30 })
  status: string;

  @Column({ name: 'payment_status', type: 'varchar', length: 30 })
  paymentStatus: string;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  subtotal: number;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  discountAmount: number;

  @Column({
    name: 'grand_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  grandAmount: number;

  @Column({
    name: 'refunded_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  refundedAmount: number;

  @Column({ name: 'is_refunded', type: 'boolean', default: false })
  isRefunded: boolean;

  @Column({ name: 'items_count', type: 'int', default: 0 })
  itemsCount: number;

  @Column({ name: 'placed_at', type: 'timestamptz', nullable: true })
  placedAt: Date | null;

  @Column({ name: 'committed_at', type: 'timestamptz' })
  committedAt: Date;
}
