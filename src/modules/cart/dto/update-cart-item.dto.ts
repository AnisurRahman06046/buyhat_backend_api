import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    minimum: 1,
    description: 'New line quantity (use DELETE to remove)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
