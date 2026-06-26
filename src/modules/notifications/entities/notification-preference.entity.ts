import { Column, Entity, Index } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';

/**
 * Per-user marketing opt-out, one row per user (D60). Defaults true (opted in);
 * TRANSACTIONAL messages ignore this table. `user_id` is a logical ref to
 * `auth.account.id`.
 */
@Entity({ schema: SCHEMA.NOTIFICATIONS, name: 'notification_preference' })
@Index('uq_notification_preference_user', ['userId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class NotificationPreference extends SoftDeletableEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'marketing_email', type: 'boolean', default: true })
  marketingEmail: boolean;

  @Column({ name: 'marketing_sms', type: 'boolean', default: true })
  marketingSms: boolean;

  @Column({ name: 'marketing_push', type: 'boolean', default: true })
  marketingPush: boolean;
}
