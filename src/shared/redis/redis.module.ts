import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/configuration';
import { REDIS_CLIENT, RedisService } from './redis.service';

/**
 * Global Redis module. Provides a single, lazily-connecting ioredis client and
 * the RedisService wrapper. Marked @Global so any module can inject RedisService
 * without re-importing — typical for shared infrastructure.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const redis = configService.get<RedisConfig>('redis')!;
        return new Redis({
          host: redis.host,
          port: redis.port,
          password: redis.password,
          // Retry with backoff; never give up so transient outages self-heal.
          retryStrategy: (times) => Math.min(times * 200, 5_000),
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        });
      },
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
