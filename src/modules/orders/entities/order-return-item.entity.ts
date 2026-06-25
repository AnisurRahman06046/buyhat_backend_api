import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { OrderItem } from './order-item.entity';
import { OrderReturn } from './order-return.entity';

/** One returned order line with the quantity being returned. */
@Entity({ schema: SCHEMA.ORDERS, name: 'order_return_item' })
@Index(['returnId'])
export class OrderReturnItem extends BaseEntity {
  @Column({ name: 'return_id', type: 'uuid' })
  returnId: string;

  @ManyToOne(() => OrderReturn, (orderReturn) => orderReturn.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'return_id' })
  return: OrderReturn;

  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ type: 'int' })
  quantity: number;
}
