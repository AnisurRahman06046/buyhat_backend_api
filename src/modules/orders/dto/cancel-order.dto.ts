import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ description: 'Why the order is being cancelled' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
