import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { RedisService } from '../../../shared/redis/redis.service';

/**
 * Custom Terminus health indicator for Redis. Uses the v11
 * `HealthIndicatorService` session API and a lightweight PING so readiness
 * probes reflect the real state of the cache/queue backend.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisService: RedisService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const pong: string = await this.redisService.getClient().ping();
      return pong === 'PONG'
        ? indicator.up()
        : indicator.down({ message: `Unexpected PING response: ${pong}` });
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }
}
