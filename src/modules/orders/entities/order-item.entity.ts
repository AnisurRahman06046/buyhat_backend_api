import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { Order } from './order.entity';

/**
 * A line on an order. SKU/name/variant-label and `unit_price` are snapshots
 * locked at checkout; `line_total = unit_price * quantity`.
 */
@Entity({ schema: SCHEMA.ORDERS, name: 'order_item' })
@Index(['orderId'])
@Index(['variantId'])
export class OrderItem extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'sku_snapshot', type: 'varchar', length: 80 })
  skuSnapshot: string;

  @Column({ name: 'product_name_snapshot', type: 'varchar', length: 250 })
  productNameSnapshot: string;

  @Column({
    name: 'variant_label_snapshot',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  variantLabelSnapshot: string | null;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  unitPrice: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  lineTotal: number;
}
