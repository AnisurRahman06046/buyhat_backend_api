import { Global, Module } from '@nestjs/common';
import { DomainEventBus } from './domain-event-bus';

/**
 * Global in-process event bus (MVP, Redis-free). Provides {@link DomainEventBus}
 * so producers (`auth`) and listeners (`users`) can exchange domain events
 * without importing each other — avoiding a module cycle and any Redis/BullMQ
 * dependency.
 */
@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class EventsModule {}
