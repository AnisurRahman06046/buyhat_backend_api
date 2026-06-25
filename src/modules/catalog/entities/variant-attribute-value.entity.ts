import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { Attribute } from './attribute.entity';
import { AttributeOption } from './attribute-option.entity';
import { ProductVariant } from './product-variant.entity';

/** One (variant-defining attribute → option) pair of a variant (e.g. Color → Red). */
@Entity({ schema: SCHEMA.CATALOG, name: 'variant_attribute_value' })
@Index('uq_variant_attribute_value', ['variantId', 'attributeId'], {
  unique: true,
})
export class VariantAttributeValue extends BaseEntity {
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @ManyToOne(() => ProductVariant, (variant) => variant.attributeValues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ name: 'attribute_id', type: 'uuid' })
  attributeId: string;

  @ManyToOne(() => Attribute, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'attribute_id' })
  attribute: Attribute;

  @Column({ name: 'option_id', type: 'uuid' })
  optionId: string;

  @ManyToOne(() => AttributeOption, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'option_id' })
  option: AttributeOption;
}
