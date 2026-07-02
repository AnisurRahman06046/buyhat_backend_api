import { getQueueToken } from '@nestjs/bullmq';
import { Global, Module, Provider } from '@nestjs/common';
import { QUEUE_NAMES } from './queue.constants';

/**
 * MVP: Redis-free background-job infrastructure.
 *
 * The real BullMQ-backed queues are disabled for the initial launch (no Redis
 * dependency). This module provides no-op stand-ins under the *same* DI tokens
 * that `@InjectQueue(name)` resolves (`getQueueToken(name)`), so producers keep
 * compiling and calling `.add()` — which becomes a harmless no-op. The matching
 * @Processor consumers are simply not registered, so nothing is dequeued.
 *
 * To re-enable real background jobs, restore the BullMQ `forRootAsync` version
 * from git history and re-register each feature module's queue + processor.
 */
const noopQueue = {
  add: (): Promise<undefined> => Promise.resolve(undefined),
  addBulk: (): Promise<[]> => Promise.resolve([]),
};

/** Queues referenced via `@InjectQueue(...)` somewhere in the codebase. */
const QUEUES_IN_USE = [
  QUEUE_NAMES.INVENTORY,
  QUEUE_NAMES.DOMAIN_EVENTS,
  QUEUE_NAMES.CATALOG_EVENTS,
  QUEUE_NAMES.NOTIFICATIONS,
];

const queueProviders: Provider[] = QUEUES_IN_USE.map((name) => ({
  provide: getQueueToken(name),
  useValue: noopQueue,
}));

@Global()
@Module({
  providers: queueProviders,
  exports: queueProviders,
})
export class QueueModule {}
