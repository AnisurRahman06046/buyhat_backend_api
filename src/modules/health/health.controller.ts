import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Operational endpoints for orchestrators (Kubernetes, ECS, load balancers).
 * All public — probes must not require auth.
 *
 *   GET /health        full readiness (DB)
 *   GET /health/live   liveness (process is up; no dependency checks)
 *   GET /health/ready  readiness (dependencies reachable)
 *
 * MVP: Redis is not part of the stack, so probes check the database only.
 */
@ApiTags('health')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Full health check (database)' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1_500 }),
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
    ]);
  }
}
