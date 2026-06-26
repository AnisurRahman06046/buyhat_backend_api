import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { AudienceTarget } from '../enums/audience-target.enum';
import { PopupFrequency } from '../enums/popup-frequency.enum';
import { PopupTrigger } from '../enums/popup-trigger.enum';

export class CreatePopupDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Stored image URL (from POST /cms/media)',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctaUrl?: string;

  @ApiPropertyOptional({ enum: PopupTrigger })
  @IsOptional()
  @IsEnum(PopupTrigger)
  trigger?: PopupTrigger;

  @ApiPropertyOptional({ description: 'Delay for AFTER_DELAY trigger' })
  @IsOptional()
  @IsInt()
  @Min(0)
  delaySeconds?: number;

  @ApiPropertyOptional({ enum: PopupFrequency })
  @IsOptional()
  @IsEnum(PopupFrequency)
  frequency?: PopupFrequency;

  @ApiPropertyOptional({ enum: AudienceTarget })
  @IsOptional()
  @IsEnum(AudienceTarget)
  audience?: AudienceTarget;

  @ApiPropertyOptional({ description: 'ISO timestamp; null = open start' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp; null = open end' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
