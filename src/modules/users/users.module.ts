import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth';
import { UserRegisteredListener } from './listeners/user-registered.listener';
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
  imports: [TypeOrmModule.forFeature([Profile, Address]), AuthModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    ProfileRepository,
    AddressRepository,
    // MVP: profiles are created from the in-process `user.registered` event
    // (see UserRegisteredListener) instead of the BullMQ domain-events consumer.
    UserRegisteredListener,
  ],
  exports: [UsersService],
})
export class UsersModule {}
