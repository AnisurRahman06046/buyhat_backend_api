import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';

/**
 * Append-only audit trail. One row per security-relevant action (login,
 * password reset, account status/role changes, …). Never updated or deleted.
 */
@Entity({ schema: SCHEMA.AUDIT, name: 'audit_log' })
@Index('idx_audit_actor_created', ['actorId', 'createdAt'])
@Index('idx_audit_action_created', ['action', 'createdAt'])
export class AuditLog extends BaseEntity {
  /** Who performed the action (logical user id; null for anonymous/system). */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 60 })
  action: string;

  @Column({ name: 'target_type', type: 'varchar', length: 50, nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
