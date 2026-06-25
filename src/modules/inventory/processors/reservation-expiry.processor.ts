import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../../shared/queue/queue.constants';
import { RESERVATION_EXPIRE_JOB } from '../inventory.constants';
import { InventoryService } from '../services/inventory.service';

interface ExpireJob {
  reservationId: string;
}

/**
 * Consumes delayed reservation-expiry jobs (D16). Releasing is idempotent — if
 * the reservation was already confirmed/released, `expire` is a no-op.
 */
@Processor(QUEUE_NAMES.INVENTORY)
export class ReservationExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationExpiryProcessor.name);

  constructor(private readonly inventoryService: InventoryService) {
    super();
  }

  async process(job: Job<ExpireJob>): Promise<void> {
    if (job.name !== RESERVATION_EXPIRE_JOB) return;
    await this.inventoryService.expire(job.data.reservationId);
    this.logger.debug(
      `Expiry processed for reservation ${job.data.reservationId}`,
    );
  }
}
