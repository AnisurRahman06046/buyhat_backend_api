import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  NOTIFICATION_SEND_JOB,
  NOTIFICATIONS_QUEUE,
} from '../notifications.constants';
import { NotificationService } from '../services/notification.service';

interface SendJob {
  notificationId: string;
}

/**
 * Consumes `{ notificationId }` jobs and delivers them via the channel adapter
 * (D63). On provider failure BullMQ retries (global defaults: 3×, exponential
 * backoff); after the final attempt the row is marked FAILED with the error.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(job: Job<SendJob>): Promise<void> {
    if (job.name !== NOTIFICATION_SEND_JOB) return;
    try {
      await this.notificationService.deliver(job.data.notificationId);
    } catch (err) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;
      if (isLastAttempt) {
        await this.notificationService.markFailed(job.data.notificationId, err);
        this.logger.error(
          `Notification ${job.data.notificationId} failed after ${maxAttempts} attempts: ${String(err)}`,
        );
        return; // swallow so the job settles; failure recorded in the log
      }
      throw err; // trigger a retry
    }
  }
}
