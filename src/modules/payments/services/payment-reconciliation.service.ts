import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';

/**
 * Reconciliation sweep (edge case #2): periodically polls the gateway for online
 * payments stuck in INITIATED/PENDING past a grace window and settles those whose
 * callback was dropped. Uses a plain interval (the codebase's sweeper pattern) so
 * it needs no extra scheduler dependency.
 */
@Injectable()
export class PaymentReconciliationService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private static readonly BATCH = 100;
  private readonly intervalMs: number;
  private readonly graceMs: number;

  constructor(
    private readonly paymentService: PaymentService,
    config: ConfigService,
  ) {
    this.intervalMs =
      (config.get<number>('payments.reconcileIntervalMinutes') ?? 5) * 60_000;
    this.graceMs =
      (config.get<number>('payments.reconcileAfterMinutes') ?? 10) * 60_000;
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.sweep(), this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    if (this.running) return; // never overlap sweeps
    this.running = true;
    try {
      const cutoff = new Date(Date.now() - this.graceMs);
      await this.paymentService.reconcile(
        cutoff,
        PaymentReconciliationService.BATCH,
      );
    } catch (err) {
      this.logger.error(`Reconciliation sweep failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
