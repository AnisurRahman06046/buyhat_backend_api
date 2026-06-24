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
 * Writes domain events to the outbox **inside the caller's transaction**, so the
 * event is committed atomically with the state change that produced it. The
 * {@link OutboxRelayService} publishes them afterwards.
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
