import { ApiProperty } from '@nestjs/swagger';
import { ProductSales } from '../entities/product-sales.entity';

/** One product's cumulative sales metrics. */
export class ProductSalesDto {
  @ApiProperty() productId: string;
  @ApiProperty() qtySold: number;
  @ApiProperty() orderCount: number;
  @ApiProperty() revenue: number;
  @ApiProperty({ nullable: true }) lastSoldAt: Date | null;

  static fromEntity(p: ProductSales): ProductSalesDto {
    const dto = new ProductSalesDto();
    dto.productId = p.productId;
    dto.qtySold = p.qtySold;
    dto.orderCount = p.orderCount;
    dto.revenue = p.revenue;
    dto.lastSoldAt = p.lastSoldAt;
    return dto;
  }
}
