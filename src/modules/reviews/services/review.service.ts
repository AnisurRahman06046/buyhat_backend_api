import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { PaginationMeta } from '../../../common/interfaces/api-response.interface';
import { buildPaginationMeta } from '../../../common/utils/pagination.util';
import { AuditAction, AuditService } from '../../audit';
import { ProductService } from '../../catalog';
import { OrderService } from '../../orders';
import { CreateReviewDto } from '../dto/create-review.dto';
import { ReviewQueryDto } from '../dto/review-query.dto';
import {
  ReviewResponseDto,
  ReviewSummaryDto,
} from '../dto/review-response.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { Review } from '../entities/review.entity';
import { ReviewStatus } from '../enums/review-status.enum';
import { ReviewRepository } from '../repositories/review.repository';
import { REVIEWS_MODERATE_ROLES } from '../reviews.constants';

export interface ProductReviews {
  data: ReviewResponseDto[];
  summary: ReviewSummaryDto;
  pagination: PaginationMeta;
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly productService: ProductService,
    private readonly orderService: OrderService,
    private readonly auditService: AuditService,
  ) {}

  /** Create a review; auto-detects verified purchase. One per (user, product). */
  async create(
    user: AuthenticatedUser,
    productId: string,
    dto: CreateReviewDto,
    ip: string | null,
  ): Promise<ReviewResponseDto> {
    if (!(await this.productService.productExists(productId))) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (await this.reviewRepository.findByUserAndProduct(user.id, productId)) {
      throw new ConflictException('You have already reviewed this product');
    }

    const orderId = await this.orderService.findPurchasedOrderId(
      user.id,
      productId,
    );
    const review = this.reviewRepository.create({
      productId,
      variantId: dto.variantId ?? null,
      userId: user.id,
      orderId,
      rating: dto.rating,
      title: dto.title ?? null,
      body: dto.body ?? null,
      isVerifiedPurchase: orderId != null,
      status: ReviewStatus.PENDING,
    });

    let saved: Review;
    try {
      saved = await this.reviewRepository.save(review);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw err;
    }

    void this.auditService.record({
      action: AuditAction.REVIEW_CREATED,
      actorId: user.id,
      targetType: 'review',
      targetId: saved.id,
      ip,
      metadata: { productId, rating: saved.rating },
    });
    return ReviewResponseDto.fromEntity(saved);
  }

  /** Public: a product's approved reviews + aggregate summary. */
  async listForProduct(
    productId: string,
    query: ReviewQueryDto,
  ): Promise<ProductReviews> {
    const [rows, total] = await this.reviewRepository.listApproved(
      productId,
      query.skip,
      query.limit,
    );
    const aggregate = await this.reviewRepository.aggregateApproved(productId);
    const summary = new ReviewSummaryDto();
    summary.ratingAvg = aggregate.avg;
    summary.ratingCount = aggregate.count;
    summary.distribution = aggregate.distribution;
    return {
      data: rows.map((r) => ReviewResponseDto.fromEntity(r)),
      summary,
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  /** Staff: moderation queue (optionally filtered by status). */
  async moderationQueue(
    query: ReviewQueryDto,
  ): Promise<{ data: ReviewResponseDto[]; pagination: PaginationMeta }> {
    const [rows, total] = await this.reviewRepository.listForModeration(
      query.status,
      query.skip,
      query.limit,
    );
    return {
      data: rows.map((r) => ReviewResponseDto.fromEntity(r)),
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  /** Staff: approve or reject a review, then refresh the product aggregate. */
  async moderate(
    reviewId: string,
    status: ReviewStatus.APPROVED | ReviewStatus.REJECTED,
    actor: AuthenticatedUser,
    ip: string | null,
  ): Promise<ReviewResponseDto> {
    const review = await this.getOrThrow(reviewId);
    review.status = status;
    const saved = await this.reviewRepository.save(review);
    await this.refreshAggregate(review.productId);

    void this.auditService.record({
      action: AuditAction.REVIEW_MODERATED,
      actorId: actor.id,
      targetType: 'review',
      targetId: review.id,
      ip,
      metadata: { status },
    });
    return ReviewResponseDto.fromEntity(saved);
  }

  /** Owner edits their review → back to PENDING (re-moderation). */
  async updateOwn(
    user: AuthenticatedUser,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.getOrThrow(reviewId);
    if (review.userId !== user.id) {
      // 404 (not 403) so we never reveal another user's review ids.
      throw new NotFoundException(`Review ${reviewId} not found`);
    }
    const wasApproved = review.status === ReviewStatus.APPROVED;
    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.title !== undefined) review.title = dto.title ?? null;
    if (dto.body !== undefined) review.body = dto.body ?? null;
    if (dto.variantId !== undefined) review.variantId = dto.variantId ?? null;
    review.status = ReviewStatus.PENDING;
    const saved = await this.reviewRepository.save(review);
    if (wasApproved) await this.refreshAggregate(review.productId);
    return ReviewResponseDto.fromEntity(saved);
  }

  /** Owner or staff deletes a review (soft); refresh aggregate if it counted. */
  async remove(user: AuthenticatedUser, reviewId: string): Promise<void> {
    const review = await this.getOrThrow(reviewId);
    if (review.userId !== user.id && !this.isStaff(user)) {
      throw new NotFoundException(`Review ${reviewId} not found`);
    }
    const wasApproved = review.status === ReviewStatus.APPROVED;
    await this.reviewRepository.softDelete(review.id);
    if (wasApproved) await this.refreshAggregate(review.productId);
  }

  /** Increment the helpful counter (no per-user dedupe yet — D58). */
  async markHelpful(reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.getOrThrow(reviewId);
    await this.reviewRepository.incrementHelpful(review.id);
    review.helpfulCount += 1;
    return ReviewResponseDto.fromEntity(review);
  }

  // --- internals -------------------------------------------------------------

  /** Recompute the product's rating aggregate from its APPROVED reviews (D54). */
  private async refreshAggregate(productId: string): Promise<void> {
    const aggregate = await this.reviewRepository.aggregateApproved(productId);
    await this.productService.applyRatingAggregate(
      productId,
      aggregate.avg,
      aggregate.count,
    );
  }

  private async getOrThrow(reviewId: string): Promise<Review> {
    const review = await this.reviewRepository.findById(reviewId);
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);
    return review;
  }

  private isStaff(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      (REVIEWS_MODERATE_ROLES as readonly string[]).includes(role),
    );
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string })?.code === '23505'
    );
  }
}
