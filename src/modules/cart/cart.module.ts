import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { InventoryModule } from '../inventory';
import { PromotionsModule } from '../promotions';
import { UsersModule } from '../users';
import { CartController } from './controllers/cart.controller';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartItemRepository } from './repositories/cart-item.repository';
import { CartRepository } from './repositories/cart.repository';
import { CartSweeperService } from './services/cart-sweeper.service';
import { CartService } from './services/cart.service';

/**
 * `cart` feature module — guest + customer carts, merge-on-login, price snapshots.
 * Reads catalog (price/sellability), inventory (availability), and promotions
 * (flash prices + coupon apply/validate) via their services. Reservation/
 * conversion happen in Phase 5 (orders).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    CatalogModule,
    InventoryModule,
    PromotionsModule,
    UsersModule,
  ],
  controllers: [CartController],
  providers: [
    CartRepository,
    CartItemRepository,
    CartService,
    CartSweeperService,
  ],
  exports: [CartService],
})
export class CartModule {}
