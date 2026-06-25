import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { QUEUE_NAMES } from '../../../shared/queue/queue.constants';
import { OutboxStatus } from '../enums/outbox-status.enum';

interface OutboxRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

/**
 * Publishes pending `catalog.outbox_event` rows to the `catalog-events` queue.
 * Polls on an interval with `FOR UPDATE SKIP LOCKED` (multi-instance safe) and
 * uses `jobId = event.id` so re-publishing is idempotent (effectively-once).
 * A behaviour-preserving copy of auth's relay (D13: duplicate-per-module).
 */
@Injectable()
export class CatalogOutboxRelayService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CatalogOutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private flushing = false;
  private static readonly POLL_INTERVAL_MS = 5_000;
  private static readonly BATCH = 50;

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.CATALOG_EVENTS) private readonly queue: Queue,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(
      () => void this.flush(),
      CatalogOutboxRelayService.POLL_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** Publish one batch of pending events. Safe to call concurrently. */
  async flush(): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    try {
      await this.dataSource.transaction(async (manager) => {
        const rows: OutboxRow[] = await manager.query(
          `SELECT id, aggregate_type, aggregate_id, event_type, payload
             FROM catalog.outbox_event
            WHERE status = $1
            ORDER BY created_at ASC
            LIMIT ${CatalogOutboxRelayService.BATCH}
            FOR UPDATE SKIP LOCKED`,
          [OutboxStatus.PENDING],
        );
        if (rows.length === 0) {
          return;
        }
        for (const row of rows) {
          await this.queue.add(
            row.event_type,
            {
              id: row.id,
              aggregateType: row.aggregate_type,
              aggregateId: row.aggregate_id,
              eventType: row.event_type,
              payload: row.payload,
            },
            { jobId: row.id },
          );
        }
        await manager.query(
          `UPDATE catalog.outbox_event
              SET status = $1, published_at = now(), attempts = attempts + 1
            WHERE id = ANY($2::uuid[])`,
          [OutboxStatus.PUBLISHED, rows.map((row) => row.id)],
        );
      });
    } catch (error) {
      this.logger.error(`Catalog outbox flush failed: ${String(error)}`);
    } finally {
      this.flushing = false;
    }
  }
}
