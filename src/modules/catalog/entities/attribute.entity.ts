import { Column, Entity, Index, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { AttributeType } from '../enums/attribute-type.enum';
import { AttributeOption } from './attribute-option.entity';

/**
 * A global, typed attribute. Assigned to categories via `category_attribute`;
 * `is_variant_defining` (SELECT/MULTISELECT only) attributes drive variant generation.
 */
@Entity({ schema: SCHEMA.CATALOG, name: 'attribute' })
export class Attribute extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 20 })
  type: AttributeType;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unit: string | null;

  @Column({ name: 'is_variant_defining', type: 'boolean', default: false })
  isVariantDefining: boolean;

  @Column({ name: 'is_filterable', type: 'boolean', default: false })
  isFilterable: boolean;

  @OneToMany(() => AttributeOption, (option) => option.attribute, {
    cascade: true,
  })
  options: AttributeOption[];
}
