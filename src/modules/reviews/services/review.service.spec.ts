import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '../../../common/enums/role.enum';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { AuditService } from '../../audit';
import { ProductService } from '../../catalog';
import { OrderService } from '../../orders';
import { Review } from '../entities/review.entity';
import { ReviewStatus } from '../enums/review-status.enum';
import { ReviewRepository } from '../repositories/review.repository';
import { ReviewService } from './review.service';

const buyer: AuthenticatedUser = {
  id: 'user-1',
  email: 'u@b.com',
  roles: [Role.CUSTOMER],
};
const staff: AuthenticatedUser = {
  id: 'mod-1',
  email: 'm@b.com',
  roles: [Role.CUSTOMER_SUPPORT],
};

const makeReview = (overrides: Partial<Review> = {}): Review =>
  ({
    id: 'rev-1',
    productId: 'prod-1',
    variantId: null,
    userId: 'user-1',
    orderId: null,
    rating: 4,
    title: null,
    body: null,
    isVerifiedPurchase: false,
    status: ReviewStatus.PENDING,
    helpfulCount: 0,
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  }) as Review;

describe('ReviewService', () => {
  let reviewRepository: jest.Mocked<ReviewRepository>;
  let productService: jest.Mocked<ProductService>;
  let orderService: jest.Mocked<OrderService>;
  let auditService: jest.Mocked<AuditService>;
  let service: ReviewService;

  beforeEach(() => {
    reviewRepository = {
      findByUserAndProduct: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      create: jest.fn((x: Partial<Review>) => x as Review),
      save: jest.fn((x: Review) =>
        Promise.resolve({ ...x, id: x.id ?? 'rev-1' }),
      ),
      softDelete: jest.fn().mockResolvedValue(undefined),
      incrementHelpful: jest.fn().mockResolvedValue(undefined),
      aggregateApproved: jest
        .fn()
        .mockResolvedValue({ avg: 0, count: 0, distribution: {} }),
    } as unknown as jest.Mocked<ReviewRepository>;
    productService = {
      productExists: jest.fn().mockResolvedValue(true),
      applyRatingAggregate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProductService>;
    orderService = {
      findPurchasedOrderId: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<OrderService>;
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    service = new ReviewService(
      reviewRepository,
      productService,
      orderService,
      auditService,
    );
  });

  it('flags a verified purchase when the user bought the product', async () => {
    orderService.findPurchasedOrderId.mockResolvedValue('order-9');
    const result = await service.create(buyer, 'prod-1', { rating: 5 }, null);
    expect(result.isVerifiedPurchase).toBe(true);
    expect(result.orderId).toBe('order-9');
  });

  it('leaves verified false when there is no qualifying purchase', async () => {
    const result = await service.create(buyer, 'prod-1', { rating: 3 }, null);
    expect(result.isVerifiedPurchase).toBe(false);
    expect(result.orderId).toBeNull();
  });

  it('starts a new review as PENDING (hidden until approved)', async () => {
    const result = await service.create(buyer, 'prod-1', { rating: 4 }, null);
    expect(result.status).toBe(ReviewStatus.PENDING);
  });

  it('rejects a duplicate review by the same user', async () => {
    reviewRepository.findByUserAndProduct.mockResolvedValue(makeReview());
    await expect(
      service.create(buyer, 'prod-1', { rating: 4 }, null),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s when reviewing a non-existent product', async () => {
    productService.productExists.mockResolvedValue(false);
    await expect(
      service.create(buyer, 'ghost', { rating: 4 }, null),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refreshes the product aggregate on approval', async () => {
    reviewRepository.findById.mockResolvedValue(makeReview());
    reviewRepository.aggregateApproved.mockResolvedValue({
      avg: 4.5,
      count: 2,
      distribution: { 4: 1, 5: 1 },
    });
    const result = await service.moderate(
      'rev-1',
      ReviewStatus.APPROVED,
      staff,
      null,
    );
    expect(result.status).toBe(ReviewStatus.APPROVED);
    expect(productService.applyRatingAggregate).toHaveBeenCalledWith(
      'prod-1',
      4.5,
      2,
    );
  });

  it('recomputes the aggregate when an approved review is deleted', async () => {
    reviewRepository.findById.mockResolvedValue(
      makeReview({ status: ReviewStatus.APPROVED }),
    );
    await service.remove(buyer, 'rev-1');
    expect(reviewRepository.softDelete).toHaveBeenCalledWith('rev-1');
    expect(productService.applyRatingAggregate).toHaveBeenCalled();
  });

  it('does not recompute when deleting a non-approved review', async () => {
    reviewRepository.findById.mockResolvedValue(
      makeReview({ status: ReviewStatus.PENDING }),
    );
    await service.remove(buyer, 'rev-1');
    expect(productService.applyRatingAggregate).not.toHaveBeenCalled();
  });

  it('blocks editing someone else’s review (404, not 403)', async () => {
    reviewRepository.findById.mockResolvedValue(
      makeReview({ userId: 'someone-else' }),
    );
    await expect(
      service.updateOwn(buyer, 'rev-1', { rating: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resets an edited review to PENDING', async () => {
    reviewRepository.findById.mockResolvedValue(
      makeReview({ status: ReviewStatus.APPROVED }),
    );
    const result = await service.updateOwn(buyer, 'rev-1', { rating: 2 });
    expect(result.status).toBe(ReviewStatus.PENDING);
    expect(result.rating).toBe(2);
    // was approved → aggregate refreshed (now excluded).
    expect(productService.applyRatingAggregate).toHaveBeenCalled();
  });
});
