import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { NotificationStatus } from '../enums/notification-status.enum';

/**
 * Append-only delivery log: one row per channel per dispatch. `user_id` is a
 * logical ref to `auth.account.id` (no cross-schema FK) and is null for
 * internal/anonymous sends. Enums stored as varchar.
 */
@Entity({ schema: SCHEMA.NOTIFICATIONS, name: 'notification' })
@Index('idx_notification_status', ['status'])
@Index('idx_notification_user', ['userId'])
export class Notification extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 20 })
  channel: string;

  @Column({ type: 'varchar', length: 320 })
  recipient: string;

  @Column({ type: 'varchar', length: 100 })
  event: string;

  @Column({ type: 'varchar', length: 20 })
  category: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 20, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;
}
