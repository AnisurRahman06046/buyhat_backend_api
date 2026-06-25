import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { Attribute } from './attribute.entity';

/** A selectable value for a SELECT/MULTISELECT attribute (Red, S, M, …). */
@Entity({ schema: SCHEMA.CATALOG, name: 'attribute_option' })
@Index('uq_attribute_option', ['attributeId', 'value'], { unique: true })
export class AttributeOption extends BaseEntity {
  @Column({ name: 'attribute_id', type: 'uuid' })
  attributeId: string;

  @ManyToOne(() => Attribute, (attribute) => attribute.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attribute_id' })
  attribute: Attribute;

  @Column({ type: 'varchar', length: 150 })
  value: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  label: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;
}
