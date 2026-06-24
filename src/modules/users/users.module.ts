import { Module } from '@nestjs/common';

/**
 * Users module — user accounts, profiles, addresses and role assignment.
 * Owns schema `users`. Other modules read user data only via UsersService,
 * never by touching its tables directly.
 *
 * Skeleton only.
 */
@Module({})
export class UsersModule {}
