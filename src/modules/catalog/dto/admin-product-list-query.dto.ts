import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProductStatus } from '../enums/product-status.enum';
import { ProductListQueryDto } from './product-list-query.dto';

/**
 * Admin product list query — the public list filters (q, category, brand,
 * price, sort) plus an optional status filter. Unlike the public list, the admin
 * endpoint returns products of any status (incl. DRAFT/ARCHIVED).
 */
export class AdminProductListQueryDto extends ProductListQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
