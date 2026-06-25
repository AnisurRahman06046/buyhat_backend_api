import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { OrderStatus } from '../enums/order-status.enum';
import { Order } from './order.entity';

/** Append-only audit trail of every order status transition. */
@Entity({ schema: SCHEMA.ORDERS, name: 'order_status_history' })
@Index(['orderId', 'createdAt'])
export class OrderStatusHistory extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    name: 'from_status',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  fromStatus: OrderStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 20 })
  toStatus: OrderStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;
}
