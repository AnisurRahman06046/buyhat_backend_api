import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';

/** stock-in / stock-out / return / damage — a positive quantity + optional reason. */
export class StockOperationDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

/** Manual correction: a signed delta applied to on-hand; reason required. */
export class AdjustStockDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: 'Signed delta applied to on-hand (non-zero)' })
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  quantityDelta: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}
