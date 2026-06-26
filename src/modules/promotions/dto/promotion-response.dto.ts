import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Coupon } from '../entities/coupon.entity';
import { Promotion } from '../entities/promotion.entity';
import { CouponType } from '../enums/coupon-type.enum';

export class CouponResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty({ enum: CouponType }) type: CouponType;
  @ApiProperty() value: number;
  @ApiPropertyOptional({ nullable: true }) minPurchaseAmount: number | null;
  @ApiPropertyOptional({ nullable: true }) maxDiscountAmount: number | null;
  @ApiPropertyOptional({ nullable: true }) usageLimit: number | null;
  @ApiPropertyOptional({ nullable: true }) usageLimitPerUser: number | null;
  @ApiPropertyOptional({ nullable: true }) usageLimitPerIp: number | null;
  @ApiProperty() usedCount: number;
  @ApiPropertyOptional({ nullable: true }) startsAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) endsAt: Date | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: [String] }) categoryIds: string[];

  static fromEntity(coupon: Coupon): CouponResponseDto {
    const dto = new CouponResponseDto();
    dto.id = coupon.id;
    dto.code = coupon.code;
    dto.type = coupon.type;
    dto.value = coupon.value;
    dto.minPurchaseAmount = coupon.minPurchaseAmount;
    dto.maxDiscountAmount = coupon.maxDiscountAmount;
    dto.usageLimit = coupon.usageLimit;
    dto.usageLimitPerUser = coupon.usageLimitPerUser;
    dto.usageLimitPerIp = coupon.usageLimitPerIp;
    dto.usedCount = coupon.usedCount;
    dto.startsAt = coupon.startsAt;
    dto.endsAt = coupon.endsAt;
    dto.isActive = coupon.isActive;
    dto.categoryIds = (coupon.categories ?? []).map((c) => c.categoryId);
    return dto;
  }
}

export class PromotionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ nullable: true }) startsAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) endsAt: Date | null;
  @ApiProperty() isActive: boolean;

  static fromEntity(promotion: Promotion): PromotionResponseDto {
    const dto = new PromotionResponseDto();
    dto.id = promotion.id;
    dto.name = promotion.name;
    dto.description = promotion.description;
    dto.startsAt = promotion.startsAt;
    dto.endsAt = promotion.endsAt;
    dto.isActive = promotion.isActive;
    return dto;
  }
}

/** Result of validating a coupon against a cart/order context. */
export class CouponQuoteDto {
  @ApiProperty() couponId: string;
  @ApiProperty() code: string;
  @ApiProperty({ enum: CouponType }) type: CouponType;
  @ApiProperty() discountAmount: number;
  @ApiProperty() freeShipping: boolean;
}
