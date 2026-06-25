import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { PaymentState } from '../enums/payment-state.enum';
import { Payment } from './payment.entity';

/** A refund issued against a successful payment (staff-initiated, D36). */
@Entity({ schema: SCHEMA.PAYMENTS, name: 'refund' })
@Index(['orderId'])
@Index(['status'])
export class Refund extends SoftDeletableEntity {
  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  amount: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 20, default: PaymentState.PENDING })
  status: PaymentState;

  @Column({
    name: 'gateway_refund_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  gatewayRefundId: string | null;
}
