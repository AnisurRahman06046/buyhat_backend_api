import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import type Redis from 'ioredis';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './shared/redis/redis.module';
import { REDIS_CLIENT } from './shared/redis/redis.service';
import { QueueModule } from './shared/queue/queue.module';
import { NotificationsModule } from './shared/notifications';
import { StorageModule } from './shared/storage';
import { AuditModule } from './modules/audit';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog';
import { InventoryModule } from './modules/inventory';
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
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redis: Redis) => ({
        throttlers: [
          {
            // config stores TTL in seconds; throttler v6 expects milliseconds.
            ttl: config.get<number>('throttle.ttl', 60) * 1_000,
            limit: config.get<number>('throttle.limit', 100),
          },
        ],
        // Back the throttler with Redis so limits are shared across replicas
        // (in-memory storage is per-instance and ineffective behind >1 pod).
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),

    DatabaseModule,
    RedisModule,
    QueueModule,
    NotificationsModule,
    StorageModule,

    // 3. FEATURE MODULES — register new modules here.
    AuditModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    InventoryModule,
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
