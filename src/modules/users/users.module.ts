import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../shared/queue/queue.constants';
import { AuthModule } from '../auth';
import { DomainEventsConsumer } from './consumers/domain-events.consumer';
import { UsersController } from './controllers/users.controller';
import { Address } from './entities/address.entity';
import { Profile } from './entities/profile.entity';
import { AddressRepository } from './repositories/address.repository';
import { ProfileRepository } from './repositories/profile.repository';
import { UsersService } from './services/users.service';

/**
 * `users` feature module — profile + addresses, and admin account management.
 * Imports `AuthModule` to use `AccountService` (cross-module via the service
 * layer) and registers the `domain-events` consumer that creates profiles from
 * the `user.registered` event.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, Address]),
    BullModule.registerQueue({ name: QUEUE_NAMES.DOMAIN_EVENTS }),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    ProfileRepository,
    AddressRepository,
    DomainEventsConsumer,
  ],
  exports: [UsersService],
})
export class UsersModule {}
