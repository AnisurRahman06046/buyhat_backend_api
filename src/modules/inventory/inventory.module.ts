import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './controllers/inventory.controller';
import { StockItem } from './entities/stock-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockReservation } from './entities/stock-reservation.entity';
import { StockItemRepository } from './repositories/stock-item.repository';
import { StockMovementRepository } from './repositories/stock-movement.repository';
import { StockReservationRepository } from './repositories/stock-reservation.repository';
import { InventoryService } from './services/inventory.service';

/**
 * `inventory` feature module — per-variant stock, an append-only movement ledger,
 * and the reservation system (atomic reserve, expiry release). Consumes catalog's
 * `variant.created` to provision stock items; cart/orders call `InventoryService`
 * directly in later phases.
 */
@Module({
  // MVP: reservation-expiry queue, the `variant.created` consumer and the
  // reservation sweeper are disabled (Redis-free, commerce off). Admin stock
  // operations (in/out/adjust/return/damage) and reporting remain.
  imports: [
    TypeOrmModule.forFeature([StockItem, StockMovement, StockReservation]),
  ],
  controllers: [InventoryController],
  providers: [
    StockItemRepository,
    StockMovementRepository,
    StockReservationRepository,
    InventoryService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
