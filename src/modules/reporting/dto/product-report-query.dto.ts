import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_SELLER_LIMIT } from '../reporting.constants';
import { ProductSalesOrder } from '../enums/product-sales-order.enum';

/** Best/worst sellers query. */
export class ProductReportQueryDto {
  @ApiPropertyOptional({
    enum: ProductSalesOrder,
    default: ProductSalesOrder.BEST,
  })
  @IsOptional()
  @IsEnum(ProductSalesOrder)
  order: ProductSalesOrder = ProductSalesOrder.BEST;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: DEFAULT_SELLER_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = DEFAULT_SELLER_LIMIT;
}
