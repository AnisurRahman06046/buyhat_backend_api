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
import { ProductStatus } from '../enums/product-status.enum';
import { Brand } from './brand.entity';
import { Category } from './category.entity';
import { ProductAttributeValue } from './product-attribute-value.entity';
import { ProductMedia } from './product-media.entity';
import { ProductVariant } from './product-variant.entity';

@Entity({ schema: SCHEMA.CATALOG, name: 'product' })
@Index(['categoryId'])
@Index(['brandId'])
@Index(['status'])
export class Product extends AuditableEntity {
  @Column({ type: 'varchar', length: 250 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 280 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId: string | null;

  @ManyToOne(() => Brand, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand | null;

  @Column({ type: 'varchar', length: 20, default: ProductStatus.DRAFT })
  status: ProductStatus;

  @Column({
    name: 'base_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    nullable: true,
  })
  basePrice: number | null;

  @Column({ type: 'char', length: 3, default: 'BDT' })
  currency: string;

  @Column({
    name: 'rating_avg',
    type: 'numeric',
    precision: 3,
    scale: 2,
    transformer: moneyTransformer,
    default: 0,
  })
  ratingAvg: number;

  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount: number;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(() => ProductAttributeValue, (value) => value.product)
  attributeValues: ProductAttributeValue[];

  @OneToMany(() => ProductMedia, (media) => media.product)
  media: ProductMedia[];
}
