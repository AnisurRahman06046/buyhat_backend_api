import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { OutboxStatus } from '../enums/outbox-status.enum';

/**
 * Catalog's transactional outbox. Written in the SAME transaction as the catalog
 * state change that produced it (e.g. variant creation), then relayed to the
 * `catalog-events` queue by {@link CatalogOutboxRelayService}. Mirrors auth's
 * outbox (D13: duplicate-per-module) so catalog stays independently extractable.
 */
@Entity({ schema: SCHEMA.CATALOG, name: 'outbox_event' })
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
