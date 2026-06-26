import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandResponseDto,
  CategoryResponseDto,
  ProductListItemDto,
} from '../../catalog';
import { FlashSaleResponseDto } from '../../promotions';
import { HomepageSection } from '../entities/homepage-section.entity';
import { HomepageSectionType } from '../enums/homepage-section-type.enum';
import { BannerResponseDto } from './banner-response.dto';

/** Admin view of a homepage section (raw config, no hydration). */
export class HomepageSectionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: HomepageSectionType }) type: HomepageSectionType;
  @ApiPropertyOptional({ nullable: true }) title: string | null;
  @ApiProperty() position: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: 'object', additionalProperties: true })
  config: Record<string, unknown>;

  static fromEntity(s: HomepageSection): HomepageSectionResponseDto {
    const dto = new HomepageSectionResponseDto();
    dto.id = s.id;
    dto.type = s.type;
    dto.title = s.title;
    dto.position = s.position;
    dto.isActive = s.isActive;
    dto.config = s.config ?? {};
    return dto;
  }
}

/**
 * Public, **hydrated** homepage section: the section metadata plus whichever
 * embedded payload its type resolves to (banners / flash sales / products /
 * categories / brands). Empty arrays when a referenced id no longer resolves.
 */
export class RenderedHomepageSectionDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: HomepageSectionType }) type: HomepageSectionType;
  @ApiPropertyOptional({ nullable: true }) title: string | null;
  @ApiProperty() position: number;

  @ApiPropertyOptional({ type: [BannerResponseDto] })
  banners?: BannerResponseDto[];
  @ApiPropertyOptional({ type: [FlashSaleResponseDto] })
  flashSales?: FlashSaleResponseDto[];
  @ApiPropertyOptional({ type: [ProductListItemDto] })
  products?: ProductListItemDto[];
  @ApiPropertyOptional({ type: [CategoryResponseDto] })
  categories?: CategoryResponseDto[];
  @ApiPropertyOptional({ type: [BrandResponseDto] })
  brands?: BrandResponseDto[];
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  config?: Record<string, unknown>;
}
