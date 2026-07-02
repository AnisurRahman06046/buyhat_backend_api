import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DomainEventBus,
  UserRegisteredEvent,
} from '../../../shared/events/domain-event-bus';
import { UsersService } from '../services/users.service';

/**
 * MVP replacement for the BullMQ `domain-events` consumer. Listens on the
 * in-process {@link DomainEventBus} for `user.registered` and provisions the
 * user's profile — idempotently, so a retry/redelivery is safe. Runs in the
 * same process as `auth`, so the profile exists immediately after registration.
 */
@Injectable()
export class UserRegisteredListener implements OnModuleInit {
  private readonly logger = new Logger(UserRegisteredListener.name);

  constructor(
    private readonly bus: DomainEventBus,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit(): void {
    this.bus.onUserRegistered((event) => {
      void this.handle(event);
    });
  }

  private async handle(event: UserRegisteredEvent): Promise<void> {
    try {
      await this.usersService.createProfileForUser({
        userId: event.userId,
        firstName: event.firstName,
        lastName: event.lastName,
      });
      this.logger.log(`Profile ensured for user ${event.userId}`);
    } catch (err) {
      this.logger.error(
        `Failed to create profile for ${event.userId}: ${String(err)}`,
      );
    }
  }
}
