import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { Attribute } from './attribute.entity';
import { Category } from './category.entity';

/** Assignment of an attribute to a category (the dynamic-attributes mechanism). */
@Entity({ schema: SCHEMA.CATALOG, name: 'category_attribute' })
@Index('uq_category_attribute', ['categoryId', 'attributeId'], { unique: true })
export class CategoryAttribute extends BaseEntity {
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'attribute_id', type: 'uuid' })
  attributeId: string;

  @ManyToOne(() => Attribute, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'attribute_id' })
  attribute: Attribute;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ type: 'int', default: 0 })
  position: number;
}
