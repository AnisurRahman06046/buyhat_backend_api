import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';

export interface OutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Records catalog domain events into `catalog.outbox_event` **inside the caller's
 * transaction**, so the event commits atomically with the state change.
 * {@link CatalogOutboxRelayService} publishes them afterwards.
 */
@Injectable()
export class OutboxService {
  record(
    manager: EntityManager,
    event: OutboxEventInput,
  ): Promise<OutboxEvent> {
    return manager.save(manager.create(OutboxEvent, event));
  }
}
