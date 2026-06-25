import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AuditableEntity } from '../../../common/entities/auditable.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { OrderAddress } from './order-address.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';

/**
 * An immutable historical record of a purchase. Prices, SKUs, names and
 * addresses are snapshotted onto the order and its children at checkout so a
 * later catalog/address change never rewrites a placed order (edge case #8).
 * `user_id`/`variant_id`/`product_id` are logical refs (no cross-schema FK).
 */
@Entity({ schema: SCHEMA.ORDERS, name: 'order' })
@Index(['userId'])
@Index(['status'])
@Index(['paymentStatus'])
export class Order extends AuditableEntity {
  @Index('uq_order_number', { unique: true })
  @Column({ name: 'order_number', type: 'varchar', length: 30 })
  orderNumber: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'guest_email', type: 'varchar', length: 320, nullable: true })
  guestEmail: string | null;

  @Column({ type: 'varchar', length: 20, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    length: 20,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @Column({ type: 'char', length: 3, default: 'BDT' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  subtotal: number;

  @Column({
    name: 'discount_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  discountTotal: number;

  @Column({
    name: 'shipping_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  shippingTotal: number;

  @Column({
    name: 'tax_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  taxTotal: number;

  @Column({
    name: 'grand_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  grandTotal: number;

  @Column({ name: 'coupon_code', type: 'varchar', length: 50, nullable: true })
  couponCode: string | null;

  @Column({ name: 'placed_at', type: 'timestamptz', nullable: true })
  placedAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @OneToMany(() => OrderAddress, (address) => address.order)
  addresses: OrderAddress[];

  @OneToMany(() => OrderStatusHistory, (history) => history.order)
  statusHistory: OrderStatusHistory[];
}
