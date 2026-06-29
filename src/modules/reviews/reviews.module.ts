import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { OrdersModule } from '../orders';
import { UsersModule } from '../users';
import { ReviewController } from './controllers/review.controller';
import { Review } from './entities/review.entity';
import { ReviewRepository } from './repositories/review.repository';
import { ReviewService } from './services/review.service';

/**
 * `reviews` feature module — product ratings/reviews with verified-purchase
 * detection (reads orders) and moderation. On any change to a product's APPROVED
 * set it pushes a recomputed rating aggregate to catalog (`applyRatingAggregate`,
 * one-way). Leaf module (nothing imports it); `AuditModule` is @Global.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
    CatalogModule,
    OrdersModule,
    // Read-only, to resolve reviewer display names in the moderation queue.
    UsersModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewRepository, ReviewService],
})
export class ReviewsModule {}
