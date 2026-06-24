import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConfig } from '../../config';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>): Redis =>
        new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db,
          keyPrefix: config.keyPrefix,
          enableReadyCheck: true,
          lazyConnect: false,
        }),
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
