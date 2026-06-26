import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';
import { SalesGranularity } from '../enums/sales-granularity.enum';

/** Sales report window + bucket size. Missing dates default to the last year. */
export class SalesReportQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({
    enum: SalesGranularity,
    default: SalesGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(SalesGranularity)
  granularity: SalesGranularity = SalesGranularity.DAY;
}
