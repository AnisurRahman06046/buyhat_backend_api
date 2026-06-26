import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { HomepageSectionType } from '../enums/homepage-section-type.enum';

/**
 * `config` is a freeform JSONB bag of section-specific selections (documented
 * keys: `productIds`, `categoryIds`, `brandIds`, `placement`, plus display
 * fields like `title`/`subtitle` for NEWSLETTER). Referenced ids are logical —
 * not existence-checked (D52).
 */
export class CreateHomepageSectionDto {
  @ApiProperty({ enum: HomepageSectionType })
  @IsEnum(HomepageSectionType)
  type: HomepageSectionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
