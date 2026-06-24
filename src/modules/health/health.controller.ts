import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RedisHealthIndicator } from './indicators/redis.health';

/**
 * Operational endpoints for orchestrators (Kubernetes, ECS, load balancers).
 * All public — probes must not require auth.
 *
 *   GET /health        full readiness (DB + Redis)
 *   GET /health/live   liveness (process is up; no dependency checks)
 *   GET /health/ready  readiness (dependencies reachable)
 */
@ApiTags('health')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Full health check (database + redis)' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1_500 }),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (dependencies reachable)' })
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1_500 }),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
