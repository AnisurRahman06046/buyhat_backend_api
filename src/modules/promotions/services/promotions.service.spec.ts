import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProductService } from '../../catalog';
import { Coupon } from '../entities/coupon.entity';
import { CouponType } from '../enums/coupon-type.enum';
import { CouponRepository } from '../repositories/coupon.repository';
import { CouponRedemptionRepository } from '../repositories/coupon-redemption.repository';
import { FlashSaleRepository } from '../repositories/flash-sale.repository';
import { FlashSaleService } from './flash-sale.service';
import { PromotionsService, QuoteCouponInput } from './promotions.service';

/** A fully-valid PERCENTAGE coupon; override fields per test. */
const makeCoupon = (overrides: Partial<Coupon> = {}): Coupon =>
  ({
    id: 'coupon-1',
    code: 'SAVE10',
    promotionId: null,
    type: CouponType.PERCENTAGE,
    value: 10,
    minPurchaseAmount: null,
    maxDiscountAmount: null,
    usageLimit: null,
    usageLimitPerUser: null,
    usageLimitPerIp: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    deletedAt: null,
    categories: [],
    ...overrides,
  }) as Coupon;

const baseInput = (
  overrides: Partial<QuoteCouponInput> = {},
): QuoteCouponInput => ({
  code: 'SAVE10',
  userId: 'user-1',
  ip: '10.0.0.1',
  subtotal: 100,
  lines: [{ productId: 'prod-1', lineTotal: 100 }],
  ...overrides,
});

describe('PromotionsService', () => {
  let couponRepository: jest.Mocked<CouponRepository>;
  let redemptionRepository: jest.Mocked<CouponRedemptionRepository>;
  let flashSaleRepository: jest.Mocked<FlashSaleRepository>;
  let productService: jest.Mocked<ProductService>;
  let flashSaleService: jest.Mocked<FlashSaleService>;
  let service: PromotionsService;

  beforeEach(() => {
    couponRepository = {
      findByCode: jest.fn(),
      incrementUsed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CouponRepository>;
    redemptionRepository = {
      countForUser: jest.fn().mockResolvedValue(0),
      countForIp: jest.fn().mockResolvedValue(0),
      existsForOrder: jest.fn().mockResolvedValue(false),
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CouponRedemptionRepository>;
    flashSaleRepository = {
      activeItemsForVariants: jest.fn().mockResolvedValue([]),
      incrementSold: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FlashSaleRepository>;
    productService = {
      getProductCategories: jest.fn().mockResolvedValue(new Map()),
    } as unknown as jest.Mocked<ProductService>;
    flashSaleService = {
      listActive: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<FlashSaleService>;

    service = new PromotionsService(
      couponRepository,
      redemptionRepository,
      flashSaleRepository,
      productService,
      flashSaleService,
    );
  });

  // --- discount math -------------------------------------------------------

  it('computes a PERCENTAGE discount', async () => {
    couponRepository.findByCode.mockResolvedValue(makeCoupon({ value: 10 }));
    const quote = await service.quoteCoupon(baseInput({ subtotal: 100 }));
    expect(quote.discountAmount).toBe(10);
    expect(quote.freeShipping).toBe(false);
  });

  it('caps a PERCENTAGE discount at maxDiscountAmount', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ value: 50, maxDiscountAmount: 20 }),
    );
    const quote = await service.quoteCoupon(baseInput({ subtotal: 100 }));
    expect(quote.discountAmount).toBe(20);
  });

  it('computes a FIXED discount, never exceeding the subtotal', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ type: CouponType.FIXED, value: 150 }),
    );
    const quote = await service.quoteCoupon(
      baseInput({ subtotal: 100, lines: [{ productId: 'p', lineTotal: 100 }] }),
    );
    expect(quote.discountAmount).toBe(100);
  });

  it('flags FREE_SHIPPING with no monetary discount', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ type: CouponType.FREE_SHIPPING, value: 0 }),
    );
    const quote = await service.quoteCoupon(baseInput());
    expect(quote.discountAmount).toBe(0);
    expect(quote.freeShipping).toBe(true);
  });

  it('discounts only category-eligible lines (D41)', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({
        value: 10,
        categories: [{ categoryId: 'cat-A' }] as Coupon['categories'],
      }),
    );
    productService.getProductCategories.mockResolvedValue(
      new Map([
        ['prod-A', 'cat-A'],
        ['prod-B', 'cat-B'],
      ]),
    );
    const quote = await service.quoteCoupon(
      baseInput({
        subtotal: 200,
        lines: [
          { productId: 'prod-A', lineTotal: 100 },
          { productId: 'prod-B', lineTotal: 100 },
        ],
      }),
    );
    // 10% of the eligible (cat-A) line only.
    expect(quote.discountAmount).toBe(10);
  });

  it('rejects a category coupon that matches no cart line', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({
        categories: [{ categoryId: 'cat-A' }] as Coupon['categories'],
      }),
    );
    productService.getProductCategories.mockResolvedValue(
      new Map([['prod-B', 'cat-B']]),
    );
    await expect(
      service.quoteCoupon(
        baseInput({ lines: [{ productId: 'prod-B', lineTotal: 100 }] }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // --- validation ----------------------------------------------------------

  it('throws NotFound for an unknown code', async () => {
    couponRepository.findByCode.mockResolvedValue(null);
    await expect(service.quoteCoupon(baseInput())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an inactive coupon', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ isActive: false }),
    );
    await expect(service.quoteCoupon(baseInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a coupon outside its validity window', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ startsAt: new Date(Date.now() + 86_400_000) }),
    );
    await expect(service.quoteCoupon(baseInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );

    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ endsAt: new Date(Date.now() - 86_400_000) }),
    );
    await expect(service.quoteCoupon(baseInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when the minimum purchase is not met', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ minPurchaseAmount: 500 }),
    );
    await expect(
      service.quoteCoupon(baseInput({ subtotal: 100 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // --- abuse controls (edge #6) -------------------------------------------

  it('rejects once the global usage limit is reached', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ usageLimit: 5, usedCount: 5 }),
    );
    await expect(service.quoteCoupon(baseInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects once the per-user limit is reached', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ usageLimitPerUser: 1 }),
    );
    redemptionRepository.countForUser.mockResolvedValue(1);
    await expect(service.quoteCoupon(baseInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects once the per-IP limit is reached', async () => {
    couponRepository.findByCode.mockResolvedValue(
      makeCoupon({ usageLimitPerIp: 2 }),
    );
    redemptionRepository.countForIp.mockResolvedValue(2);
    await expect(service.quoteCoupon(baseInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // --- flash prices --------------------------------------------------------

  it('returns the lowest active flash price per variant', async () => {
    flashSaleRepository.activeItemsForVariants.mockResolvedValue([
      { variantId: 'v1', salePrice: 80 },
      { variantId: 'v1', salePrice: 70 },
      { variantId: 'v2', salePrice: 50 },
    ] as Awaited<ReturnType<FlashSaleRepository['activeItemsForVariants']>>);
    const prices = await service.getActiveFlashPrices(['v1', 'v2']);
    expect(prices.get('v1')).toBe(70);
    expect(prices.get('v2')).toBe(50);
  });

  // --- redemption ----------------------------------------------------------

  it('records a redemption and bumps the global counter', async () => {
    couponRepository.findByCode.mockResolvedValue(makeCoupon());
    await service.redeemForOrder({
      orderId: 'order-1',
      userId: 'user-1',
      ip: '10.0.0.1',
      code: 'SAVE10',
      discountAmount: 10,
      variantIds: ['v1'],
    });
    expect(redemptionRepository.save).toHaveBeenCalledTimes(1);
    expect(couponRepository.incrementUsed).toHaveBeenCalledWith('coupon-1');
    expect(flashSaleRepository.incrementSold).toHaveBeenCalledWith(
      ['v1'],
      expect.any(Date),
    );
  });

  it('is idempotent: an already-redeemed order is not double-counted (D40)', async () => {
    couponRepository.findByCode.mockResolvedValue(makeCoupon());
    redemptionRepository.existsForOrder.mockResolvedValue(true);
    await service.redeemForOrder({
      orderId: 'order-1',
      code: 'SAVE10',
      discountAmount: 10,
    });
    expect(redemptionRepository.save).not.toHaveBeenCalled();
    expect(couponRepository.incrementUsed).not.toHaveBeenCalled();
  });
});
