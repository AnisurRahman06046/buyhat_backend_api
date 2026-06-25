import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../shared/queue/queue.constants';
import { CatalogEventsConsumer } from './consumers/catalog-events.consumer';
import { InventoryController } from './controllers/inventory.controller';
import { StockItem } from './entities/stock-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockReservation } from './entities/stock-reservation.entity';
import { ReservationExpiryProcessor } from './processors/reservation-expiry.processor';
import { StockItemRepository } from './repositories/stock-item.repository';
import { StockMovementRepository } from './repositories/stock-movement.repository';
import { StockReservationRepository } from './repositories/stock-reservation.repository';
import { InventoryService } from './services/inventory.service';
import { ReservationSweeperService } from './services/reservation-sweeper.service';

/**
 * `inventory` feature module — per-variant stock, an append-only movement ledger,
 * and the reservation system (atomic reserve, expiry release). Consumes catalog's
 * `variant.created` to provision stock items; cart/orders call `InventoryService`
 * directly in later phases.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([StockItem, StockMovement, StockReservation]),
    // Delayed reservation-expiry jobs.
    BullModule.registerQueue({ name: QUEUE_NAMES.INVENTORY }),
    // Consume catalog domain events (variant.created).
    BullModule.registerQueue({ name: QUEUE_NAMES.CATALOG_EVENTS }),
  ],
  controllers: [InventoryController],
  providers: [
    StockItemRepository,
    StockMovementRepository,
    StockReservationRepository,
    InventoryService,
    ReservationSweeperService,
    ReservationExpiryProcessor,
    CatalogEventsConsumer,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
