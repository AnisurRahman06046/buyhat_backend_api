import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { MediaType } from '../enums/media-type.enum';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

/**
 * An image/video for a product (optionally scoped to a variant). `storage_key`
 * is the object key in the storage backend (source of truth for delete); `url`
 * is the public URL captured at upload time. At most one primary per product is
 * enforced by a partial unique index.
 */
@Entity({ schema: SCHEMA.CATALOG, name: 'product_media' })
@Index(['productId'])
@Index(['variantId'])
@Index('uq_product_primary_media', ['productId'], {
  unique: true,
  where: '"is_primary" = true',
})
export class ProductMedia extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

  @ManyToOne(() => ProductVariant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'varchar', length: 20, default: MediaType.IMAGE })
  type: MediaType;

  @Column({ name: 'storage_key', type: 'varchar', length: 500, nullable: true })
  storageKey: string | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  alt: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'int', default: 0 })
  position: number;
}
