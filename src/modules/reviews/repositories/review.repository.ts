import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Review } from '../entities/review.entity';
import { ReviewStatus } from '../enums/review-status.enum';

/** Aggregate over a product's APPROVED reviews. */
export interface RatingAggregate {
  avg: number;
  count: number;
  distribution: Record<number, number>;
}

@Injectable()
export class ReviewRepository extends BaseRepository<Review> {
  constructor(
    @InjectRepository(Review)
    repo: Repository<Review>,
  ) {
    super(repo);
  }

  /** Active review by a user for a product (enforces one-per-product). */
  findByUserAndProduct(
    userId: string,
    productId: string,
  ): Promise<Review | null> {
    return this.findOne({ where: { userId, productId } });
  }

  /** Public listing: a product's APPROVED reviews, newest first. */
  listApproved(
    productId: string,
    skip: number,
    take: number,
  ): Promise<[Review[], number]> {
    return this.paginate(skip, take, {
      where: { productId, status: ReviewStatus.APPROVED },
      order: { createdAt: 'DESC' },
    });
  }

  /** Moderation queue, optionally filtered by status, newest first. */
  listForModeration(
    status: ReviewStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[Review[], number]> {
    return this.paginate(skip, take, {
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  incrementHelpful(id: string): Promise<unknown> {
    return this.repository.increment({ id }, 'helpfulCount', 1);
  }

  /** Recompute avg/count/star-distribution over a product's APPROVED reviews. */
  async aggregateApproved(productId: string): Promise<RatingAggregate> {
    const qb = this.repository
      .createQueryBuilder('r')
      .where('r.product_id = :productId', { productId })
      .andWhere('r.status = :status', { status: ReviewStatus.APPROVED })
      .andWhere('r.deleted_at IS NULL');

    const totals = await qb
      .clone()
      .select('COALESCE(AVG(r.rating), 0)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .getRawOne<{ avg: string; count: string }>();

    const rows = await qb
      .clone()
      .select('r.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.rating')
      .getRawMany<{ rating: number; count: string }>();

    const distribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const row of rows) {
      distribution[Number(row.rating)] = Number(row.count);
    }
    return {
      avg: totals ? Math.round(parseFloat(totals.avg) * 100) / 100 : 0,
      count: totals ? parseInt(totals.count, 10) : 0,
      distribution,
    };
  }
}
