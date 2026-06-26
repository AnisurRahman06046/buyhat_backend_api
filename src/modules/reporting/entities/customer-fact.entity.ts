import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';

/**
 * Per-customer aggregate fact (read model), keyed unique by `user_id`. Seeded on
 * registration and incremented on each committed order. Drives the customers
 * report (new = registered in window; repeat = `orders_count >= 2`).
 */
@Entity({ schema: SCHEMA.REPORTING, name: 'customer_fact' })
@Index('uq_customer_fact_user', ['userId'], { unique: true })
export class CustomerFact extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'registered_at', type: 'timestamptz' })
  registeredAt: Date;

  @Column({ name: 'first_order_at', type: 'timestamptz', nullable: true })
  firstOrderAt: Date | null;

  @Column({ name: 'orders_count', type: 'int', default: 0 })
  ordersCount: number;

  @Column({
    name: 'total_spent',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  totalSpent: number;

  @Column({ name: 'last_order_at', type: 'timestamptz', nullable: true })
  lastOrderAt: Date | null;
}
