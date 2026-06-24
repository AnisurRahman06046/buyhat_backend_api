import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { configurations, envValidationSchema, throttleConfig } from './config';
import {
  AllExceptionsFilter,
  JwtAuthGuard,
  ResponseInterceptor,
  RolesGuard,
  TimeoutInterceptor,
  TypeOrmExceptionFilter,
} from './common';
import { DatabaseModule } from './infra/database';
import { HealthModule } from './infra/health';
import { LoggerModule } from './infra/logger';
import { QueueModule } from './infra/queue';
import { RedisModule } from './infra/redis';
import { StorageModule } from './infra/storage';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { CmsModule } from './modules/cms/cms.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ReportingModule } from './modules/reporting/reporting.module';

/**
 * Composition root. Wires the global infrastructure (config, logging, db,
 * cache, queues, storage, rate limiting, health) and registers the
 * cross-cutting guards/filters/interceptors that every request flows through.
 *
 * Domain modules under src/modules/* are imported here as they come online.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configurations,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    StorageModule,
    ThrottlerModule.forRootAsync({
      inject: [throttleConfig.KEY],
      useFactory: (config: ConfigType<typeof throttleConfig>) => ({
        throttlers: [{ ttl: config.ttl, limit: config.limit }],
      }),
    }),
    HealthModule,

    // Domain modules (skeletons for now; each owns its own Postgres schema).
    AuthModule,
    UsersModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    InventoryModule,
    PaymentsModule,
    PromotionsModule,
    CmsModule,
    NotificationsModule,
    ReviewsModule,
    ReportingModule,
  ],
  providers: [
    // Guards run in array order: rate-limit first, then authenticate, then
    // authorize (RolesGuard reads the user JwtAuthGuard attaches).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // Filters: Nest runs global APP_FILTERs in reverse registration order, so
    // the specific TypeOrm filter (registered last) runs before the catch-all.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: TypeOrmExceptionFilter },

    // Interceptors: ResponseInterceptor is outermost (formats the envelope),
    // TimeoutInterceptor sits closer to the handler to bound its runtime.
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule {}
