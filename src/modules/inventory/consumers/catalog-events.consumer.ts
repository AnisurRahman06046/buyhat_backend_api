import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../../shared/queue/queue.constants';
import { InventoryService } from '../services/inventory.service';

interface DomainEventJob {
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Consumes catalog domain events relayed from `catalog.outbox_event`. Reacts to
 * `variant.created` by provisioning a `stock_item` (qty 0) — idempotently, so
 * redelivery is safe.
 */
@Processor(QUEUE_NAMES.CATALOG_EVENTS)
export class CatalogEventsConsumer extends WorkerHost {
  private readonly logger = new Logger(CatalogEventsConsumer.name);

  constructor(private readonly inventoryService: InventoryService) {
    super();
  }

  async process(job: Job<DomainEventJob>): Promise<void> {
    if (job.data.eventType !== 'variant.created') return;
    const variantId = job.data.payload.variantId as string;
    await this.inventoryService.provisionStockItem(variantId);
    this.logger.log(`Stock item ensured for variant ${variantId}`);
  }
}
