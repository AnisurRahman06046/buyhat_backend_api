import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';

/**
 * Cumulative units-sold fact per product (read model), keyed unique by
 * `product_id`. Incremented atomically on each order commit. Drives best/worst
 * sellers and CMS auto best-sellers (D67). `product_id` is a logical ref to
 * `catalog.product.id`.
 */
@Entity({ schema: SCHEMA.REPORTING, name: 'product_sales' })
@Index('uq_product_sales_product', ['productId'], { unique: true })
@Index('idx_product_sales_qty', ['qtySold'])
export class ProductSales extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'qty_sold', type: 'int', default: 0 })
  qtySold: number;

  @Column({ name: 'order_count', type: 'int', default: 0 })
  orderCount: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  revenue: number;

  @Column({ name: 'last_sold_at', type: 'timestamptz', nullable: true })
  lastSoldAt: Date | null;
}
