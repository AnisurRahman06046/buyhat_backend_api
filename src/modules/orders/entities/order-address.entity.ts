import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { OrderAddressType } from '../enums/order-address-type.enum';
import { Order } from './order.entity';

/**
 * An immutable address snapshot for an order — deliberately NOT a foreign key
 * to `users.address`, so editing/deleting the saved address never alters a
 * placed order.
 */
@Entity({ schema: SCHEMA.ORDERS, name: 'order_address' })
@Index(['orderId'])
export class OrderAddress extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 20 })
  type: OrderAddressType;

  @Column({ name: 'recipient_name', type: 'varchar', length: 150 })
  recipientName: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'line1', type: 'varchar', length: 255 })
  line1: string;

  @Column({ name: 'line2', type: 'varchar', length: 255, nullable: true })
  line2: string | null;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ type: 'char', length: 2, default: 'BD' })
  country: string;
}
