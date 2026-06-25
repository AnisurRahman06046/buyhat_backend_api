import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartStatus } from '../enums/cart-status.enum';
import { CartRepository } from '../repositories/cart.repository';

/**
 * Abandoned-cart detection (D23): a periodic sweep marks ACTIVE carts idle beyond
 * `cart.abandonedAfterMinutes` as ABANDONED and logs a `cart.abandoned` signal.
 * A sweep (vs a per-cart delayed job) models "inactivity" cleanly because every
 * cart action resets `last_activity_at`. Real customer delivery lands in Phase 10.
 */
@Injectable()
export class CartSweeperService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CartSweeperService.name);
  private timer?: NodeJS.Timeout;
  private sweeping = false;
  private static readonly INTERVAL_MS = 5 * 60_000;
  private static readonly BATCH = 200;
  private readonly abandonedAfterMs: number;

  constructor(
    private readonly cartRepository: CartRepository,
    config: ConfigService,
  ) {
    this.abandonedAfterMs =
      (config.get<number>('cart.abandonedAfterMinutes') ?? 1440) * 60_000;
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(
      () => void this.sweep(),
      CartSweeperService.INTERVAL_MS,
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
      const before = new Date(Date.now() - this.abandonedAfterMs);
      const carts = await this.cartRepository.findIdleActive(
        before,
        CartSweeperService.BATCH,
      );
      for (const cart of carts) {
        cart.status = CartStatus.ABANDONED;
        await this.cartRepository.save(cart);
        this.logger.log(
          `cart.abandoned ${cart.id} (user=${cart.userId ?? '-'} guest=${cart.guestId ?? '-'})`,
        );
      }
      if (carts.length > 0) {
        this.logger.log(`Marked ${carts.length} cart(s) abandoned`);
      }
    } catch (err) {
      this.logger.error(`Cart sweep failed: ${String(err)}`);
    } finally {
      this.sweeping = false;
    }
  }
}
