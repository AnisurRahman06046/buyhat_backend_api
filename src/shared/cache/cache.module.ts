import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global cache-aside infrastructure. Binds {@link CacheService} (built on the
 * shared Redis client) so any module can cache hot reads with single-flight
 * stampede protection — no per-module wiring. RedisModule is already @Global.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
