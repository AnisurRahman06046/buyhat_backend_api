import { Column, Entity, Index } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';

/**
 * A standalone content page addressed by a unique slug. `content` holds
 * structured blocks (JSONB) the storefront renders; only published pages are
 * returned publicly.
 */
@Entity({ schema: SCHEMA.CMS, name: 'landing_page' })
export class LandingPage extends SoftDeletableEntity {
  @Index('uq_landing_page_slug', { unique: true })
  @Column({ type: 'varchar', length: 180 })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'jsonb', default: {} })
  content: Record<string, unknown>;

  @Column({ name: 'seo_title', type: 'varchar', length: 200, nullable: true })
  seoTitle: string | null;

  @Column({
    name: 'seo_description',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  seoDescription: string | null;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;
}
