import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReservationStatus } from '../enums/reservation-status.enum';
import { InventoryService } from './inventory.service';

/**
 * Backstop for reservation expiry (D16): a periodic sweep releases any HELD
 * reservation past `expires_at` whose delayed BullMQ job was lost (e.g. a Redis
 * flush). `InventoryService.expire` is idempotent, so overlap with the delayed
 * job (or another instance's sweep) is harmless.
 */
@Injectable()
export class ReservationSweeperService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ReservationSweeperService.name);
  private timer?: NodeJS.Timeout;
  private sweeping = false;
  private static readonly INTERVAL_MS = 60_000;
  private static readonly BATCH = 200;

  constructor(
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(
      () => void this.sweep(),
      ReservationSweeperService.INTERVAL_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const rows: { id: string }[] = await this.dataSource.query(
        `SELECT id FROM inventory.stock_reservation
          WHERE status = $1 AND expires_at < now()
          ORDER BY expires_at ASC
          LIMIT ${ReservationSweeperService.BATCH}`,
        [ReservationStatus.HELD],
      );
      for (const row of rows) {
        try {
          await this.inventoryService.expire(row.id);
        } catch (err) {
          this.logger.error(
            `Sweeper failed to expire reservation ${row.id}: ${String(err)}`,
          );
        }
      }
      if (rows.length > 0) {
        this.logger.log(`Swept ${rows.length} expired reservation(s)`);
      }
    } catch (err) {
      this.logger.error(`Reservation sweep failed: ${String(err)}`);
    } finally {
      this.sweeping = false;
    }
  }
}
