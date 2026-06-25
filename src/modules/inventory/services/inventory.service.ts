import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DataSource, EntityManager } from 'typeorm';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from '../../../shared/notifications';
import { QUEUE_NAMES } from '../../../shared/queue/queue.constants';
import { buildPaginationMeta } from '../../../common/utils/pagination.util';
import { PaginationMeta } from '../../../common/interfaces/api-response.interface';
import {
  AdjustStockDto,
  MovementQueryDto,
  MovementResponseDto,
  ReserveStockDto,
  ReservationResponseDto,
  StockAvailabilityDto,
  StockOperationDto,
} from '../dto';
import { StockItem } from '../entities/stock-item.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockReservation } from '../entities/stock-reservation.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';
import { StockMovementType } from '../enums/stock-movement-type.enum';
import {
  LOW_STOCK_ALERT_EMAIL,
  RESERVATION_EXPIRE_JOB,
} from '../inventory.constants';
import { StockItemRepository } from '../repositories/stock-item.repository';
import { StockMovementRepository } from '../repositories/stock-movement.repository';

interface MovementInput {
  variantId: string;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  createdBy?: string | null;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private readonly reservationTtlMs: number;

  constructor(
    private readonly stockItemRepository: StockItemRepository,
    private readonly movementRepository: StockMovementRepository,
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.INVENTORY) private readonly queue: Queue,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notifications: NotificationProvider,
    config: ConfigService,
  ) {
    this.reservationTtlMs =
      (config.get<number>('inventory.reservationTtlMinutes') ?? 15) * 60_000;
  }

  /** Idempotently create a stock_item (qty 0) for a new variant (`variant.created`). */
  async provisionStockItem(variantId: string): Promise<void> {
    if (await this.stockItemRepository.existsForVariant(variantId)) return;
    try {
      await this.stockItemRepository.save(
        this.stockItemRepository.create({
          variantId,
          quantityOnHand: 0,
          quantityReserved: 0,
          reorderLevel: 0,
        }),
      );
    } catch (err) {
      // Concurrent provision → unique violation; fine if the row now exists.
      if (!(await this.stockItemRepository.existsForVariant(variantId))) {
        throw err;
      }
    }
  }

  // --- stock operations (admin) ---

  stockIn(
    dto: StockOperationDto,
    actorId: string,
  ): Promise<StockAvailabilityDto> {
    return this.mutateOnHand(
      dto.variantId,
      dto.quantity,
      StockMovementType.IN,
      dto.reason ?? null,
      actorId,
    );
  }

  stockOut(
    dto: StockOperationDto,
    actorId: string,
  ): Promise<StockAvailabilityDto> {
    return this.mutateOnHand(
      dto.variantId,
      -dto.quantity,
      StockMovementType.OUT,
      dto.reason ?? null,
      actorId,
    );
  }

  returnStock(
    dto: StockOperationDto,
    actorId: string,
  ): Promise<StockAvailabilityDto> {
    return this.mutateOnHand(
      dto.variantId,
      dto.quantity,
      StockMovementType.RETURN,
      dto.reason ?? null,
      actorId,
    );
  }

  damageStock(
    dto: StockOperationDto,
    actorId: string,
  ): Promise<StockAvailabilityDto> {
    return this.mutateOnHand(
      dto.variantId,
      -dto.quantity,
      StockMovementType.DAMAGE,
      dto.reason ?? null,
      actorId,
    );
  }

  adjust(dto: AdjustStockDto, actorId: string): Promise<StockAvailabilityDto> {
    return this.mutateOnHand(
      dto.variantId,
      dto.quantityDelta,
      StockMovementType.ADJUST,
      dto.reason,
      actorId,
    );
  }

  /** Apply a signed on-hand delta + write the ledger row, atomically. */
  private async mutateOnHand(
    variantId: string,
    delta: number,
    type: StockMovementType,
    reason: string | null,
    actorId: string,
  ): Promise<StockAvailabilityDto> {
    let crossed = false;
    let snapshot!: StockItem;

    await this.dataSource.transaction(async (manager) => {
      const item = await this.lockOrCreate(manager, variantId);
      const newOnHand = item.quantityOnHand + delta;
      if (newOnHand < 0) {
        throw new BadRequestException(
          `Insufficient on-hand (${item.quantityOnHand}) for delta ${delta}`,
        );
      }
      if (newOnHand < item.quantityReserved) {
        throw new ConflictException(
          `On-hand ${newOnHand} would drop below reserved ${item.quantityReserved}`,
        );
      }
      const availBefore = item.quantityOnHand - item.quantityReserved;
      item.quantityOnHand = newOnHand;
      item.updatedBy = actorId;
      await manager.save(item);
      await this.writeMovement(manager, {
        variantId,
        type,
        quantity: delta,
        balanceAfter: newOnHand,
        reason,
        createdBy: actorId,
      });
      crossed = this.lowStockCrossed(
        availBefore,
        newOnHand - item.quantityReserved,
        item.reorderLevel,
      );
      snapshot = item;
    });

    if (crossed) this.alertLowStock(snapshot);
    return StockAvailabilityDto.fromEntity(snapshot);
  }

  // --- reservations ---

  /** Atomically reserve stock without overselling (D14: conditional UPDATE). */
  async reserve(
    dto: ReserveStockDto,
    actorId: string,
  ): Promise<ReservationResponseDto> {
    const ttlMs = dto.ttlMinutes
      ? dto.ttlMinutes * 60_000
      : this.reservationTtlMs;
    const expiresAt = new Date(Date.now() + ttlMs);
    let crossed = false;
    let lowStockItem: StockItem | null = null;

    const reservation = await this.dataSource.transaction(async (manager) => {
      // Atomic guard: increment reserved only if enough is available. The row
      // lock serializes concurrent reservers; each re-evaluates the WHERE on the
      // committed row, so the last unit can be reserved exactly once (D14).
      // `qty` is a validated positive integer → safe to inline.
      const qty = dto.quantity;
      const result = await manager
        .createQueryBuilder()
        .update(StockItem)
        .set({
          quantityReserved: () => `quantity_reserved + ${qty}`,
          version: () => 'version + 1',
        })
        .where(
          `variant_id = :variantId AND quantity_on_hand - quantity_reserved >= ${qty}`,
          { variantId: dto.variantId },
        )
        .returning('*')
        .execute();

      const updated = result.raw as Array<{
        quantity_on_hand: number;
        quantity_reserved: number;
        reorder_level: number;
      }>;
      if (updated.length === 0) {
        if (!(await this.stockItemRepository.existsForVariant(dto.variantId))) {
          throw new NotFoundException(`No stock for variant ${dto.variantId}`);
        }
        throw new ConflictException('Insufficient available stock to reserve');
      }
      const row = updated[0];
      const reference = dto.cartId
        ? { type: 'CART', id: dto.cartId }
        : dto.orderId
          ? { type: 'ORDER', id: dto.orderId }
          : { type: null, id: null };

      const saved = await manager.save(
        manager.create(StockReservation, {
          variantId: dto.variantId,
          quantity: dto.quantity,
          status: ReservationStatus.HELD,
          cartId: dto.cartId ?? null,
          orderId: dto.orderId ?? null,
          expiresAt,
        }),
      );
      await this.writeMovement(manager, {
        variantId: dto.variantId,
        type: StockMovementType.RESERVE,
        quantity: dto.quantity,
        balanceAfter: row.quantity_on_hand,
        referenceType: reference.type,
        referenceId: reference.id,
        createdBy: actorId,
      });

      const availAfter = row.quantity_on_hand - row.quantity_reserved;
      crossed = this.lowStockCrossed(
        availAfter + dto.quantity,
        availAfter,
        row.reorder_level,
      );
      if (crossed) {
        lowStockItem = Object.assign(new StockItem(), {
          variantId: dto.variantId,
          quantityOnHand: row.quantity_on_hand,
          quantityReserved: row.quantity_reserved,
          reorderLevel: row.reorder_level,
        });
      }
      return saved;
    });

    // Schedule expiry release (delayed job; jobId dedups, handler is idempotent).
    await this.queue.add(
      RESERVATION_EXPIRE_JOB,
      { reservationId: reservation.id },
      { delay: ttlMs, jobId: `expire-${reservation.id}` },
    );

    if (crossed && lowStockItem) this.alertLowStock(lowStockItem);
    return ReservationResponseDto.fromEntity(reservation);
  }

  /** Confirm a held reservation → reserved becomes sold (on-hand decreases). */
  confirm(
    reservationId: string,
    actorId: string,
  ): Promise<ReservationResponseDto> {
    return this.transitionReservation(
      reservationId,
      ReservationStatus.CONFIRMED,
      actorId,
    );
  }

  /** Manually release a held reservation back to available. */
  release(
    reservationId: string,
    actorId: string,
  ): Promise<ReservationResponseDto> {
    return this.transitionReservation(
      reservationId,
      ReservationStatus.RELEASED,
      actorId,
    );
  }

  /** Expiry path (delayed job / sweeper): release a still-HELD reservation. */
  async expire(reservationId: string): Promise<void> {
    await this.transitionReservation(
      reservationId,
      ReservationStatus.EXPIRED,
      null,
    );
  }

  private async transitionReservation(
    reservationId: string,
    target: ReservationStatus,
    actorId: string | null,
  ): Promise<ReservationResponseDto> {
    const reservation = await this.dataSource.transaction(async (manager) => {
      const res = await manager.findOne(StockReservation, {
        where: { id: reservationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!res) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }
      if (res.status !== ReservationStatus.HELD) {
        // Idempotent: re-issuing the same transition is a no-op; a conflicting
        // transition (e.g. confirm an already-released hold) is rejected.
        if (res.status === target) return res;
        throw new ConflictException(
          `Reservation is ${res.status}, cannot move to ${target}`,
        );
      }

      const item = await this.lockOrCreate(manager, res.variantId);
      if (target === ReservationStatus.CONFIRMED) {
        item.quantityOnHand -= res.quantity;
        item.quantityReserved -= res.quantity;
        item.updatedBy = actorId;
        await manager.save(item);
        await this.writeMovement(manager, {
          variantId: res.variantId,
          type: StockMovementType.SALE,
          quantity: -res.quantity,
          balanceAfter: item.quantityOnHand,
          referenceType: res.orderId ? 'ORDER' : res.cartId ? 'CART' : null,
          referenceId: res.orderId ?? res.cartId ?? null,
          createdBy: actorId,
        });
      } else {
        // RELEASED or EXPIRED: free the hold, on-hand unchanged.
        item.quantityReserved = Math.max(
          0,
          item.quantityReserved - res.quantity,
        );
        item.updatedBy = actorId;
        await manager.save(item);
        await this.writeMovement(manager, {
          variantId: res.variantId,
          type: StockMovementType.RELEASE,
          quantity: -res.quantity,
          balanceAfter: item.quantityOnHand,
          reason: target === ReservationStatus.EXPIRED ? 'expired' : null,
          createdBy: actorId,
        });
      }
      res.status = target;
      await manager.save(res);
      return res;
    });
    return ReservationResponseDto.fromEntity(reservation);
  }

  // --- reads ---

  async getAvailability(variantId: string): Promise<StockAvailabilityDto> {
    const item = await this.stockItemRepository.findByVariant(variantId);
    return item
      ? StockAvailabilityDto.fromEntity(item)
      : StockAvailabilityDto.empty(variantId);
  }

  async getBulkAvailability(
    variantIds: string[],
  ): Promise<StockAvailabilityDto[]> {
    const items = await this.stockItemRepository.findByVariants(variantIds);
    const byVariant = new Map(items.map((i) => [i.variantId, i]));
    return variantIds.map((id) => {
      const item = byVariant.get(id);
      return item
        ? StockAvailabilityDto.fromEntity(item)
        : StockAvailabilityDto.empty(id);
    });
  }

  async getMovements(
    variantId: string,
    query: MovementQueryDto,
  ): Promise<{ data: MovementResponseDto[]; pagination: PaginationMeta }> {
    const [rows, total] = await this.movementRepository.findByVariant(
      variantId,
      query.skip,
      query.limit,
    );
    return {
      data: rows.map((m) => MovementResponseDto.fromEntity(m)),
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  // --- helpers ---

  /** Pessimistically lock the variant's stock_item, creating it if absent. */
  private async lockOrCreate(
    manager: EntityManager,
    variantId: string,
  ): Promise<StockItem> {
    const existing = await manager.findOne(StockItem, {
      where: { variantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (existing) return existing;
    return manager.save(
      manager.create(StockItem, {
        variantId,
        quantityOnHand: 0,
        quantityReserved: 0,
        reorderLevel: 0,
      }),
    );
  }

  private writeMovement(
    manager: EntityManager,
    input: MovementInput,
  ): Promise<StockMovement> {
    return manager.save(
      manager.create(StockMovement, {
        variantId: input.variantId,
        type: input.type,
        quantity: input.quantity,
        balanceAfter: input.balanceAfter,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        reason: input.reason ?? null,
        createdBy: input.createdBy ?? null,
      }),
    );
  }

  private lowStockCrossed(
    availBefore: number,
    availAfter: number,
    reorderLevel: number,
  ): boolean {
    return (
      reorderLevel > 0 &&
      availBefore > reorderLevel &&
      availAfter <= reorderLevel
    );
  }

  /** Best-effort low-stock alert (never throws; recipients formalized in Phase 10). */
  private alertLowStock(item: StockItem): void {
    const available = item.quantityOnHand - item.quantityReserved;
    this.logger.warn(
      `Low stock for variant ${item.variantId}: available ${available} ≤ reorder ${item.reorderLevel}`,
    );
    void this.notifications
      .sendEmail(
        LOW_STOCK_ALERT_EMAIL,
        `Low stock: variant ${item.variantId}`,
        `Available ${available} is at or below reorder level ${item.reorderLevel}.`,
      )
      .catch((err) =>
        this.logger.error(`Low-stock alert failed: ${String(err)}`),
      );
  }
}
