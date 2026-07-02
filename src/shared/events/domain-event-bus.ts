import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

/** Payload for the `user.registered` domain event. */
export interface UserRegisteredEvent {
  userId: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * MVP in-process domain event bus (Node `EventEmitter`, no Redis/BullMQ).
 *
 * For the initial launch we run without Redis, so the transactional-outbox →
 * BullMQ relay is disabled. This bus replaces it for the single cross-module
 * sync the MVP keeps — `auth` → `users` profile creation — by delivering the
 * event in-process, synchronously, within the same Node process. Single-instance
 * only; restore the outbox/BullMQ relay (see git history) for durable, multi-
 * instance eventing.
 */
@Injectable()
export class DomainEventBus {
  private readonly emitter = new EventEmitter();

  private static readonly USER_REGISTERED = 'user.registered';

  /** Publish `user.registered` to all in-process listeners. */
  emitUserRegistered(payload: UserRegisteredEvent): void {
    this.emitter.emit(DomainEventBus.USER_REGISTERED, payload);
  }

  /** Subscribe to `user.registered`. */
  onUserRegistered(handler: (payload: UserRegisteredEvent) => void): void {
    this.emitter.on(DomainEventBus.USER_REGISTERED, handler);
  }
}
