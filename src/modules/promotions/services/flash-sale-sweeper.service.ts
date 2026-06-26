import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { FLASH_SALE_SWEEP_INTERVAL_MS } from '../promotions.constants';
import { FlashSaleService } from './flash-sale.service';

/**
 * Auto-activates/ends flash sales on schedule (D43). Pricing reads use the time
 * window directly, so this only keeps the `status` column accurate for display;
 * a plain interval avoids a scheduler dependency (matches the other sweepers).
 */
@Injectable()
export class FlashSaleSweeperService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(FlashSaleSweeperService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly flashSaleService: FlashSaleService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(
      () => void this.sweep(),
      FLASH_SALE_SWEEP_INTERVAL_MS,
    );
    if (this.timer.unref) this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.flashSaleService.sweep();
    } catch (err) {
      this.logger.error(`Flash-sale sweep failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
