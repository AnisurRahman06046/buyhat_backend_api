import { Column, Entity, Index } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { ReviewStatus } from '../enums/review-status.enum';

/**
 * A product rating + review. `product_id` / `user_id` / `order_id` are logical
 * cross-module refs (no FK). One active review per (user, product) is enforced by
 * a partial-unique index; `rating` carries a CHECK (1..5) added in the migration.
 */
@Entity({ schema: SCHEMA.REVIEWS, name: 'review' })
@Index('uq_review_user_product', ['userId', 'productId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index(['productId', 'status'])
export class Review extends SoftDeletableEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'is_verified_purchase', type: 'boolean', default: false })
  isVerifiedPurchase: boolean;

  @Column({ type: 'varchar', length: 20, default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @Column({ name: 'helpful_count', type: 'int', default: 0 })
  helpfulCount: number;
}
