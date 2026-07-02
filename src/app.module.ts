import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DatabaseModule } from './database/database.module';
// MVP: Redis removed for the initial launch. RedisModule is no longer wired;
// QueueModule + CacheModule are no-op stand-ins and auth's RefreshTokenStore is
// in-memory. The in-process EventsModule replaces the outbox→BullMQ relay.
import { QueueModule } from './shared/queue/queue.module';
import { EventsModule } from './shared/events';
import { NotificationProviderModule } from './shared/notifications';
import { StorageModule } from './shared/storage';
import { CacheModule } from './shared/cache';
import { AuditModule } from './modules/audit';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog';
import { InventoryModule } from './modules/inventory';
// MVP: commerce (cart / orders / payments) disabled for the initial launch.
// import { CartModule } from './modules/cart';
// import { OrdersModule } from './modules/orders';
// import { PaymentsModule } from './modules/payments';
import { PromotionsModule } from './modules/promotions';
import { CmsModule } from './modules/cms';
import { ReviewsModule } from './modules/reviews';
import { NotificationsModule } from './modules/notifications';
import { ReportingModule } from './modules/reporting';
import { HealthModule } from './modules/health/health.module';

/**
 * Composition root of the modular monolith.
 *
 * Layout:
 *   1. Platform config (env validation, typed configuration).
 *   2. Cross-cutting infrastructure (logging, rate limiting, DB, Redis, queues).
 *   3. Feature modules — each one self-contained; add new ones here only.
 *   4. Global guards via APP_GUARD (DI-aware). Execution order = listed order:
 *      throttle -> authenticate -> authorize.
 *
 * Adding a feature module is a one-line change in the FEATURE MODULES block.
 */
@Module({
  imports: [
    // 1. Configuration — validated at boot, available everywhere.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate,
    }),

    // 2. Infrastructure
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('app.env') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
            // Never log secrets.
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            // Correlation id: honour an inbound X-Request-Id (from an upstream
            // proxy / gateway) or mint one, and echo it back so every log line
            // and the client share a trace id.
            genReqId: (req: IncomingMessage, res: ServerResponse): string => {
              const header = req.headers['x-request-id'];
              const id =
                (Array.isArray(header) ? header[0] : header) ?? randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            // config stores TTL in seconds; throttler v6 expects milliseconds.
            ttl: config.get<number>('throttle.ttl', 60) * 1_000,
            limit: config.get<number>('throttle.limit', 100),
          },
        ],
        // MVP: default in-memory storage (no Redis). Per-instance limits are
        // fine for a single-node launch; re-add ThrottlerStorageRedisService
        // when running multiple replicas.
      }),
    }),

    DatabaseModule,
    QueueModule,
    EventsModule,
    NotificationProviderModule,
    StorageModule,
    CacheModule,

    // 3. FEATURE MODULES — register new modules here.
    AuditModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    InventoryModule,
    // MVP: commerce disabled — CartModule, OrdersModule, PaymentsModule.
    PromotionsModule,
    CmsModule,
    ReviewsModule,
    NotificationsModule,
    ReportingModule,
    HealthModule,
  ],
  providers: [
    // 4. Global guards (DI-aware). Order = execution order.
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // rate limit first
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // then authenticate
    { provide: APP_GUARD, useClass: RolesGuard }, // then authorize (RBAC)
  ],
})
export class AppModule {}
