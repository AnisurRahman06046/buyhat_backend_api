/**
 * Public API of the `users` module. Other modules import ONLY from this barrel.
 */
export { UsersModule } from './users.module';
export { UsersService } from './services/users.service';
export type { AddressSnapshot } from './services/users.service';
