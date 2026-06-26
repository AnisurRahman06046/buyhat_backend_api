import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductService } from '../../catalog';
import { CouponQuoteDto } from '../dto/promotion-response.dto';
import { FlashSaleResponseDto } from '../dto/flash-sale-response.dto';
import { CouponType } from '../enums/coupon-type.enum';
import { CouponRepository } from '../repositories/coupon.repository';
import { CouponRedemptionRepository } from '../repositories/coupon-redemption.repository';
import { FlashSaleRepository } from '../repositories/flash-sale.repository';
import { FlashSaleService } from './flash-sale.service';

/** A priced cart/order line as the discount engine needs it. */
export interface QuoteLine {
  productId: string;
  lineTotal: number;
}

export interface QuoteCouponInput {
  code: string;
  userId?: string | null;
  ip?: string | null;
  lines: QuoteLine[];
  subtotal: number;
}

export interface RedeemInput {
  orderId: string;
  userId?: string | null;
  ip?: string | null;
  code?: string | null;
  discountAmount: number;
  variantIds?: string[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Cross-module facade for the discount engine. Cart and orders call these — they
 * never touch promotions tables. Pure functions over a passed context (no cart
 * fetch) so there is no promotions↔cart cycle; promotions depends only on catalog.
 */
@Injectable()
export class PromotionsService {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly redemptionRepository: CouponRedemptionRepository,
    private readonly flashSaleRepository: FlashSaleRepository,
    private readonly productService: ProductService,
    private readonly flashSaleService: FlashSaleService,
  ) {}

  /** Cross-module (cms): currently-active flash sales for homepage hydration. */
  listActiveFlashSales(): Promise<FlashSaleResponseDto[]> {
    return this.flashSaleService.listActive();
  }

  /** Lowest active flash-sale price per variant right now (empty if none). */
  async getActiveFlashPrices(
    variantIds: string[],
  ): Promise<Map<string, number>> {
    const items = await this.flashSaleRepository.activeItemsForVariants(
      variantIds,
      new Date(),
    );
    const prices = new Map<string, number>();
    for (const item of items) {
      const current = prices.get(item.variantId);
      if (current == null || item.salePrice < current) {
        prices.set(item.variantId, item.salePrice);
      }
    }
    return prices;
  }

  /**
   * Validate a coupon against a cart/order context and compute the discount.
   * Enforces active window, min purchase, category eligibility, and the global /
   * per-user / per-IP usage limits (edge #6). Throws with a reason if invalid.
   */
  async quoteCoupon(input: QuoteCouponInput): Promise<CouponQuoteDto> {
    const code = input.code.trim().toUpperCase();
    const coupon = await this.couponRepository.findByCode(code);
    if (!coupon || coupon.deletedAt) {
      throw new NotFoundException(`Coupon "${code}" not found`);
    }

    const now = new Date();
    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Coupon is not yet valid');
    }
    if (coupon.endsAt && coupon.endsAt <= now) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new ConflictException('Coupon usage limit reached');
    }
    if (input.userId && coupon.usageLimitPerUser != null) {
      const used = await this.redemptionRepository.countForUser(
        coupon.id,
        input.userId,
      );
      if (used >= coupon.usageLimitPerUser) {
        throw new ConflictException(
          'You have reached the usage limit for this coupon',
        );
      }
    }
    if (input.ip && coupon.usageLimitPerIp != null) {
      const used = await this.redemptionRepository.countForIp(
        coupon.id,
        input.ip,
      );
      if (used >= coupon.usageLimitPerIp) {
        throw new ConflictException(
          'Coupon usage limit reached for this network',
        );
      }
    }

    // Category eligibility → the subtotal the discount may apply to.
    const restrictedCategories = (coupon.categories ?? []).map(
      (c) => c.categoryId,
    );
    let eligibleSubtotal = input.subtotal;
    if (restrictedCategories.length > 0) {
      const categoryByProduct = await this.productService.getProductCategories(
        input.lines.map((l) => l.productId),
      );
      const allowed = new Set(restrictedCategories);
      eligibleSubtotal = input.lines
        .filter((l) => allowed.has(categoryByProduct.get(l.productId) ?? ''))
        .reduce((sum, l) => sum + l.lineTotal, 0);
      if (eligibleSubtotal <= 0) {
        throw new BadRequestException(
          'Coupon does not apply to any item in your cart',
        );
      }
    }

    if (
      coupon.minPurchaseAmount != null &&
      input.subtotal < coupon.minPurchaseAmount
    ) {
      throw new BadRequestException(
        `A minimum purchase of ${coupon.minPurchaseAmount} is required for this coupon`,
      );
    }

    let discountAmount = 0;
    let freeShipping = false;
    switch (coupon.type) {
      case CouponType.PERCENTAGE:
        discountAmount = round2(eligibleSubtotal * (coupon.value / 100));
        if (coupon.maxDiscountAmount != null) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
        break;
      case CouponType.FIXED:
        discountAmount = Math.min(coupon.value, eligibleSubtotal);
        break;
      case CouponType.FREE_SHIPPING:
        freeShipping = true;
        break;
    }
    discountAmount = Math.min(round2(discountAmount), eligibleSubtotal);

    const quote = new CouponQuoteDto();
    quote.couponId = coupon.id;
    quote.code = coupon.code;
    quote.type = coupon.type;
    quote.discountAmount = discountAmount;
    quote.freeShipping = freeShipping;
    return quote;
  }

  /**
   * Record a coupon redemption + bump counters at order commit (payment success,
   * D40). Idempotent via unique (coupon_id, order_id). Also advances flash-sale
   * sold counts for the order's variants (best-effort).
   */
  async redeemForOrder(input: RedeemInput): Promise<void> {
    if (input.code) {
      const code = input.code.trim().toUpperCase();
      const coupon = await this.couponRepository.findByCode(code);
      if (
        coupon &&
        !(await this.redemptionRepository.existsForOrder(
          coupon.id,
          input.orderId,
        ))
      ) {
        try {
          await this.redemptionRepository.save(
            this.redemptionRepository.create({
              couponId: coupon.id,
              userId: input.userId ?? null,
              orderId: input.orderId,
              discountAmount: input.discountAmount,
              ipAddress: input.ip ?? null,
            }),
          );
          await this.couponRepository.incrementUsed(coupon.id);
        } catch (err) {
          if (!this.isUniqueViolation(err)) throw err; // concurrent → already recorded
        }
      }
    }

    if (input.variantIds && input.variantIds.length > 0) {
      await this.flashSaleRepository.incrementSold(
        input.variantIds,
        new Date(),
      );
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string })?.code === '23505'
    );
  }
}
