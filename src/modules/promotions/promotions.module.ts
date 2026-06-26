import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { CouponController } from './controllers/coupon.controller';
import { FlashSaleController } from './controllers/flash-sale.controller';
import { PromotionController } from './controllers/promotion.controller';
import { Coupon } from './entities/coupon.entity';
import { CouponCategory } from './entities/coupon-category.entity';
import { CouponRedemption } from './entities/coupon-redemption.entity';
import { FlashSale } from './entities/flash-sale.entity';
import { FlashSaleItem } from './entities/flash-sale-item.entity';
import { Promotion } from './entities/promotion.entity';
import { CouponRepository } from './repositories/coupon.repository';
import { CouponRedemptionRepository } from './repositories/coupon-redemption.repository';
import { FlashSaleRepository } from './repositories/flash-sale.repository';
import { PromotionRepository } from './repositories/promotion.repository';
import { CouponService } from './services/coupon.service';
import { FlashSaleService } from './services/flash-sale.service';
import { FlashSaleSweeperService } from './services/flash-sale-sweeper.service';
import { PromotionService } from './services/promotion.service';
import { PromotionsService } from './services/promotions.service';

/**
 * `promotions` feature module — coupon engine (abuse controls), scheduled flash
 * sales, and campaigns. `PromotionsService` is the cross-module facade cart and
 * orders call (quote/redeem/flash-prices); it resolves product categories via
 * CatalogService (promotions → catalog, one-way).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Promotion,
      Coupon,
      CouponCategory,
      CouponRedemption,
      FlashSale,
      FlashSaleItem,
    ]),
    CatalogModule,
  ],
  controllers: [CouponController, FlashSaleController, PromotionController],
  providers: [
    CouponRepository,
    CouponRedemptionRepository,
    FlashSaleRepository,
    PromotionRepository,
    CouponService,
    FlashSaleService,
    PromotionService,
    PromotionsService,
    FlashSaleSweeperService,
  ],
  exports: [PromotionsService],
})
export class PromotionsModule {}
