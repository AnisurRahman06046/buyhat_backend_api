import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { PaymentState } from '../enums/payment-state.enum';
import { PaymentTxnType } from '../enums/payment-txn-type.enum';
import { Payment } from './payment.entity';

/**
 * Append-only ledger of every interaction with a payment (charge, callback,
 * webhook, refund). `gateway_txn_id` is unique (where present) so a re-delivered
 * webhook is a no-op (edge case #2).
 */
@Entity({ schema: SCHEMA.PAYMENTS, name: 'payment_transaction' })
@Index(['paymentId'])
export class PaymentTransaction extends BaseEntity {
  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment, (payment) => payment.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ type: 'varchar', length: 20 })
  type: PaymentTxnType;

  @Column({ type: 'varchar', length: 20 })
  status: PaymentState;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  amount: number;

  @Index('uq_txn_gateway_id', {
    unique: true,
    where: '"gateway_txn_id" IS NOT NULL',
  })
  @Column({
    name: 'gateway_txn_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  gatewayTxnId: string | null;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown> | null;
}
