import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartModule } from '../cart';
import { CatalogModule } from '../catalog';
import { InventoryModule } from '../inventory';
import { PromotionsModule } from '../promotions';
import { UsersModule } from '../users';
import { OrderController } from './controllers/order.controller';
import { OrderReturnController } from './controllers/order-return.controller';
import { Order } from './entities/order.entity';
import { OrderAddress } from './entities/order-address.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderReturn } from './entities/order-return.entity';
import { OrderReturnItem } from './entities/order-return-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderRepository } from './repositories/order.repository';
import { OrderReturnRepository } from './repositories/order-return.repository';
import { OrderReturnService } from './services/order-return.service';
import { OrderService } from './services/order.service';

/**
 * `orders` feature module — checkout, the order lifecycle state machine,
 * cancellations and returns. Converts a cart (CartService) into an immutable
 * order, locks prices via CatalogService, holds/deducts/returns stock via
 * InventoryService, and snapshots addresses via UsersService — all through
 * those modules' public services, never their tables. `AuditService` is global.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderAddress,
      OrderStatusHistory,
      OrderReturn,
      OrderReturnItem,
    ]),
    CartModule,
    CatalogModule,
    InventoryModule,
    PromotionsModule,
    UsersModule,
  ],
  controllers: [OrderController, OrderReturnController],
  providers: [
    OrderRepository,
    OrderReturnRepository,
    OrderService,
    OrderReturnService,
  ],
  exports: [OrderService],
})
export class OrdersModule {}
