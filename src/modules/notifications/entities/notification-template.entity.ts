import { Column, Entity, Index } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';

/**
 * DB override of an in-code default template, keyed by (event, channel) (D62).
 * Absence of a row means the in-code default is used; `is_active=false` disables
 * the channel for that event entirely.
 */
@Entity({ schema: SCHEMA.NOTIFICATIONS, name: 'notification_template' })
@Index('uq_notification_template_event_channel', ['event', 'channel'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class NotificationTemplate extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 100 })
  event: string;

  @Column({ type: 'varchar', length: 20 })
  channel: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
