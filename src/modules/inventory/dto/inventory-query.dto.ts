import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto';

/** Bulk availability lookup: `?variantIds=a,b,c`. */
export class AvailabilityQueryDto {
  @ApiProperty({ description: 'Comma-separated variant ids', type: String })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  variantIds: string[];
}

/** Paginated movement-ledger query. */
export class MovementQueryDto extends PaginationQueryDto {}
