import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

/**
 * REFERENCE PATTERN — a BullMQ worker (consumer).
 *
 * This intentionally contains NO business logic; it shows the shape every
 * processor should follow:
 *   1. Annotate the class with @Processor(<queue name>).
 *   2. Extend WorkerHost and implement `process(job)`.
 *   3. Switch on `job.name` if the queue carries multiple job types.
 *   4. Return a value (stored as the job result) or throw to trigger retries.
 *
 * To create a real worker: copy this file, point @Processor at your queue, and
 * register the queue in QueueModule via BullModule.registerQueue.
 */
@Processor(QUEUE_NAMES.EXAMPLE)
export class ExampleProcessor extends WorkerHost {
  private readonly logger = new Logger(ExampleProcessor.name);

  process(job: Job<unknown>): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} (${job.name})`);
    // ... do work here (await your async work) ...
    return Promise.resolve({ processedAt: new Date().toISOString() });
  }
}
