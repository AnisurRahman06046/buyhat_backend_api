import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { Attribute } from './attribute.entity';
import { Product } from './product.entity';

/** A product's NON-variant attribute value (e.g. Material = Cotton). */
@Entity({ schema: SCHEMA.CATALOG, name: 'product_attribute_value' })
@Index('uq_product_attribute_value', ['productId', 'attributeId'], {
  unique: true,
})
@Index('idx_pav_attribute_option', ['attributeId', 'optionId'])
export class ProductAttributeValue extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.attributeValues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'attribute_id', type: 'uuid' })
  attributeId: string;

  @ManyToOne(() => Attribute, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'attribute_id' })
  attribute: Attribute;

  /** Set for SELECT/MULTISELECT attributes. */
  @Column({ name: 'option_id', type: 'uuid', nullable: true })
  optionId: string | null;

  /** Set for STRING/NUMBER/BOOLEAN attributes. */
  @Column({ name: 'value_text', type: 'varchar', length: 255, nullable: true })
  valueText: string | null;
}
