import { Column, Entity, Index } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { HomepageSectionType } from '../enums/homepage-section-type.enum';

/**
 * One ordered block of the homepage. `config` holds section-specific selections
 * (e.g. `productIds`, `categoryIds`, `placement`) referenced as logical ids — no
 * FK to catalog, so the homepage never blocks on a product/category delete.
 */
@Entity({ schema: SCHEMA.CMS, name: 'homepage_section' })
@Index(['isActive', 'position'])
export class HomepageSection extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 30 })
  type: HomepageSectionType;

  @Column({ type: 'varchar', length: 150, nullable: true })
  title: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;
}
