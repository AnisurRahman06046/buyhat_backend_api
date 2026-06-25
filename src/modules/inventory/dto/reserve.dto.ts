import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/** Create a reservation (a TTL hold) on stock for a cart/order. */
export class ReserveStockDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Override the default hold TTL (minutes)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ttlMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;
}

/** Release or confirm an existing reservation. */
export class ReservationActionDto {
  @ApiProperty()
  @IsUUID()
  reservationId: string;
}
