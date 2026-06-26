import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { FlashSale } from './flash-sale.entity';

/** A discounted variant within a flash sale (logical variant/product refs). */
@Entity({ schema: SCHEMA.PROMOTIONS, name: 'flash_sale_item' })
@Index('uq_flash_item_variant', ['flashSaleId', 'variantId'], { unique: true })
@Index(['variantId'])
export class FlashSaleItem extends BaseEntity {
  @Column({ name: 'flash_sale_id', type: 'uuid' })
  flashSaleId: string;

  @ManyToOne(() => FlashSale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flash_sale_id' })
  flashSale: FlashSale;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({
    name: 'sale_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  salePrice: number;

  @Column({ name: 'quantity_limit', type: 'int', nullable: true })
  quantityLimit: number | null;

  @Column({ name: 'sold_count', type: 'int', default: 0 })
  soldCount: number;
}
