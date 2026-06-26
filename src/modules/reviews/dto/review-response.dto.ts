import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Review } from '../entities/review.entity';
import { ReviewStatus } from '../enums/review-status.enum';

export class ReviewResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiPropertyOptional({ nullable: true }) variantId: string | null;
  @ApiProperty() userId: string;
  @ApiPropertyOptional({ nullable: true }) orderId: string | null;
  @ApiProperty() rating: number;
  @ApiPropertyOptional({ nullable: true }) title: string | null;
  @ApiPropertyOptional({ nullable: true }) body: string | null;
  @ApiProperty() isVerifiedPurchase: boolean;
  @ApiProperty({ enum: ReviewStatus }) status: ReviewStatus;
  @ApiProperty() helpfulCount: number;
  @ApiProperty() createdAt: Date;

  static fromEntity(r: Review): ReviewResponseDto {
    const dto = new ReviewResponseDto();
    dto.id = r.id;
    dto.productId = r.productId;
    dto.variantId = r.variantId;
    dto.userId = r.userId;
    dto.orderId = r.orderId;
    dto.rating = r.rating;
    dto.title = r.title;
    dto.body = r.body;
    dto.isVerifiedPurchase = r.isVerifiedPurchase;
    dto.status = r.status;
    dto.helpfulCount = r.helpfulCount;
    dto.createdAt = r.createdAt;
    return dto;
  }
}

/** Aggregate summary returned alongside a product's public review list. */
export class ReviewSummaryDto {
  @ApiProperty() ratingAvg: number;
  @ApiProperty() ratingCount: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Count of approved reviews per star (1..5)',
  })
  distribution: Record<number, number>;
}
