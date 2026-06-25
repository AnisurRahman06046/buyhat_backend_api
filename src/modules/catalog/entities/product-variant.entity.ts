import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AuditableEntity } from '../../../common/entities/auditable.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { Product } from './product.entity';
import { VariantAttributeValue } from './variant-attribute-value.entity';

/**
 * A concrete sellable variant of a product (e.g. Red + Small). `attribute_signature`
 * is a canonical, ordered hash of its (attribute → option) pairs; the unique
 * (product_id, attribute_signature) index makes generation idempotent and forbids
 * duplicate combinations. Stock lives in the inventory module (logical ref).
 */
@Entity({ schema: SCHEMA.CATALOG, name: 'product_variant' })
@Index('uq_variant_signature', ['productId', 'attributeSignature'], {
  unique: true,
})
@Index('uq_variant_barcode', ['barcode'], {
  unique: true,
  where: '"barcode" IS NOT NULL',
})
export class ProductVariant extends AuditableEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  sku: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  barcode: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  price: number;

  @Column({
    name: 'compare_at_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    nullable: true,
  })
  compareAtPrice: number | null;

  @Column({
    type: 'numeric',
    precision: 8,
    scale: 3,
    transformer: moneyTransformer,
    nullable: true,
  })
  weight: number | null;

  @Column({ name: 'weight_unit', type: 'varchar', length: 5, default: 'kg' })
  weightUnit: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'attribute_signature',
    type: 'varchar',
    length: 500,
    default: '',
  })
  attributeSignature: string;

  @OneToMany(() => VariantAttributeValue, (value) => value.variant, {
    cascade: true,
  })
  attributeValues: VariantAttributeValue[];
}
