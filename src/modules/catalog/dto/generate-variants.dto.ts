import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class VariantDefaultsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;
}

export class VariantOverrideDto {
  @ApiProperty({
    description: 'attribute code → option id identifying the combination',
  })
  @IsObject()
  match: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;
}

export class GenerateVariantsDto {
  @ApiProperty({
    description: 'variant-defining attribute code → array of option ids',
    example: { size: ['<opt-s>', '<opt-m>'], color: ['<opt-red>'] },
  })
  @IsObject()
  options: Record<string, string[]>;

  @ApiPropertyOptional({ type: VariantDefaultsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VariantDefaultsDto)
  defaults?: VariantDefaultsDto;

  @ApiPropertyOptional({ type: [VariantOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOverrideDto)
  overrides?: VariantOverrideDto[];
}
