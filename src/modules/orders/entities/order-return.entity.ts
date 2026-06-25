import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { ReturnStatus } from '../enums/return-status.enum';
import { Order } from './order.entity';
import { OrderReturnItem } from './order-return-item.entity';

/** A return request against a delivered order, covering one or more lines. */
@Entity({ schema: SCHEMA.ORDERS, name: 'order_return' })
@Index(['orderId'])
@Index(['status'])
export class OrderReturn extends SoftDeletableEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 20, default: ReturnStatus.REQUESTED })
  status: ReturnStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @OneToMany(() => OrderReturnItem, (item) => item.return)
  items: OrderReturnItem[];
}
