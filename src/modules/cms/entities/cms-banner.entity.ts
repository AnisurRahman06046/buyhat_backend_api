import { Column, Entity, Index } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { BannerPlacement } from '../enums/banner-placement.enum';

/**
 * An image + CTA placed somewhere on the storefront with an optional schedule
 * window. Hero slides are simply banners with `HOME_HERO` placement (no separate
 * table); ordering within a placement is `position`.
 */
@Entity({ schema: SCHEMA.CMS, name: 'cms_banner' })
@Index(['placement', 'isActive', 'position'])
export class CmsBanner extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150, nullable: true })
  title: string | null;

  @Column({ name: 'image_url', type: 'text' })
  imageUrl: string;

  @Column({ name: 'mobile_image_url', type: 'text', nullable: true })
  mobileImageUrl: string | null;

  @Column({ name: 'cta_text', type: 'varchar', length: 80, nullable: true })
  ctaText: string | null;

  @Column({ name: 'cta_url', type: 'text', nullable: true })
  ctaUrl: string | null;

  @Column({ type: 'varchar', length: 20 })
  placement: BannerPlacement;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
