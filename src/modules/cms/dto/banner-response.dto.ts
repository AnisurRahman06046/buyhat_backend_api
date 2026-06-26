import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CmsBanner } from '../entities/cms-banner.entity';
import { BannerPlacement } from '../enums/banner-placement.enum';

export class BannerResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ nullable: true }) title: string | null;
  @ApiProperty() imageUrl: string;
  @ApiPropertyOptional({ nullable: true }) mobileImageUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) ctaText: string | null;
  @ApiPropertyOptional({ nullable: true }) ctaUrl: string | null;
  @ApiProperty({ enum: BannerPlacement }) placement: BannerPlacement;
  @ApiProperty() position: number;
  @ApiPropertyOptional({ nullable: true }) startsAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) endsAt: Date | null;
  @ApiProperty() isActive: boolean;

  static fromEntity(b: CmsBanner): BannerResponseDto {
    const dto = new BannerResponseDto();
    dto.id = b.id;
    dto.title = b.title;
    dto.imageUrl = b.imageUrl;
    dto.mobileImageUrl = b.mobileImageUrl;
    dto.ctaText = b.ctaText;
    dto.ctaUrl = b.ctaUrl;
    dto.placement = b.placement;
    dto.position = b.position;
    dto.startsAt = b.startsAt;
    dto.endsAt = b.endsAt;
    dto.isActive = b.isActive;
    return dto;
  }
}
