import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../../shared/queue/queue.constants';
import { UsersService } from '../services/users.service';

interface DomainEventJob {
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Consumes cross-module domain events relayed from producers' outboxes. Reacts
 * to `user.registered` by creating the profile — idempotently, so redelivery is
 * safe.
 */
@Processor(QUEUE_NAMES.DOMAIN_EVENTS)
export class DomainEventsConsumer extends WorkerHost {
  private readonly logger = new Logger(DomainEventsConsumer.name);

  constructor(private readonly usersService: UsersService) {
    super();
  }

  async process(job: Job<DomainEventJob>): Promise<void> {
    if (job.data.eventType !== 'user.registered') {
      return;
    }
    const payload = job.data.payload;
    await this.usersService.createProfileForUser({
      userId: payload.userId as string,
      firstName: (payload.firstName as string | null) ?? null,
      lastName: (payload.lastName as string | null) ?? null,
    });
    this.logger.log(`Profile ensured for user ${String(payload.userId)}`);
  }
}
