import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { OutboxStatus } from '../enums/outbox-status.enum';

/**
 * Transactional outbox. Written in the SAME database transaction as the state
 * change that produced it (e.g. account creation), then relayed asynchronously
 * to the `domain-events` queue — eliminating the dual-write problem between the
 * DB and the message broker.
 *
 * Lives in the `auth` schema (auth is the only producer in Phase 1); promote to
 * a shared abstraction when a second module starts emitting events.
 */
@Entity({ schema: SCHEMA.AUTH, name: 'outbox_event' })
@Index(['status', 'createdAt'])
export class OutboxEvent extends BaseEntity {
  @Column({ name: 'aggregate_type', type: 'varchar', length: 50 })
  aggregateType: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
