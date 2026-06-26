import { Column, Entity, Index } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { AudienceTarget } from '../enums/audience-target.enum';
import { PopupFrequency } from '../enums/popup-frequency.enum';
import { PopupTrigger } from '../enums/popup-trigger.enum';

/**
 * A modal promo with display rules. `trigger`/`frequency`/`delaySeconds` are
 * enforced client-side; the server only schedules (window) and targets
 * (`audience`, filtered by the caller's auth state — D50).
 */
@Entity({ schema: SCHEMA.CMS, name: 'cms_popup' })
@Index(['isActive', 'startsAt', 'endsAt'])
export class CmsPopup extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'cta_text', type: 'varchar', length: 80, nullable: true })
  ctaText: string | null;

  @Column({ name: 'cta_url', type: 'text', nullable: true })
  ctaUrl: string | null;

  @Column({ type: 'varchar', length: 20, default: PopupTrigger.ON_LOAD })
  trigger: PopupTrigger;

  @Column({ name: 'delay_seconds', type: 'int', default: 0 })
  delaySeconds: number;

  @Column({ type: 'varchar', length: 20, default: PopupFrequency.ONCE })
  frequency: PopupFrequency;

  @Column({ type: 'varchar', length: 20, default: AudienceTarget.EVERYONE })
  audience: AudienceTarget;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
