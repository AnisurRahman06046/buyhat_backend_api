import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../shared/queue/queue.constants';
import { ReportingModule } from '../reporting';
import { AuthController } from './controllers/auth.controller';
import { Account } from './entities/account.entity';
import { AccountRole } from './entities/account-role.entity';
import { OneTimeToken } from './entities/one-time-token.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { AccountRepository } from './repositories/account.repository';
import { OneTimeTokenRepository } from './repositories/one-time-token.repository';
import { AccountService } from './services/account.service';
import { Argon2PasswordHasher } from './services/argon2-password-hasher';
import { AuthService } from './services/auth.service';
import { OneTimeTokenService } from './services/one-time-token.service';
import { OutboxRelayService } from './services/outbox-relay.service';
import { OutboxService } from './services/outbox.service';
import { PASSWORD_HASHER } from './services/password-hasher';
import { RefreshTokenStore } from './services/refresh-token.store';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * `auth` feature module — identity, credentials, roles, and the transactional
 * outbox. Registers the `jwt` Passport strategy (making the global JwtAuthGuard
 * operational) and exports `AuthService` + `AccountService` for other modules.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Account, AccountRole, OneTimeToken, OutboxEvent]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    BullModule.registerQueue({ name: QUEUE_NAMES.DOMAIN_EVENTS }),
    ReportingModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountService,
    TokenService,
    RefreshTokenStore,
    OneTimeTokenService,
    OutboxService,
    OutboxRelayService,
    AccountRepository,
    OneTimeTokenRepository,
    JwtStrategy,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
  exports: [AuthService, AccountService],
})
export class AuthModule {}
