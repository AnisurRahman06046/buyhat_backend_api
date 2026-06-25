import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AuditableEntity } from '../../../common/entities/auditable.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { PaymentGateway } from '../enums/payment-gateway.enum';
import { PaymentState } from '../enums/payment-state.enum';
import { PaymentTransaction } from './payment-transaction.entity';

/**
 * A payment attempt for an order via one gateway. `idempotency_key` is unique so
 * a retried initiate cannot create duplicates; `order_id`/`user_id` are logical
 * refs (no cross-schema FK).
 */
@Entity({ schema: SCHEMA.PAYMENTS, name: 'payment' })
@Index(['orderId'])
@Index(['status'])
export class Payment extends AuditableEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 20 })
  gateway: PaymentGateway;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  amount: number;

  @Column({ type: 'char', length: 3, default: 'BDT' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: PaymentState.INITIATED })
  status: PaymentState;

  @Index('uq_payment_idempotency_key', { unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey: string;

  @Column({
    name: 'gateway_reference',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  gatewayReference: string | null;

  @OneToMany(() => PaymentTransaction, (txn) => txn.payment)
  transactions: PaymentTransaction[];
}
