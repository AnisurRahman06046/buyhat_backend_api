import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '../enums/product-status.enum';
import { Product } from '../entities/product.entity';

/** Lightweight product shape for list endpoints. */
export class ProductListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ enum: ProductStatus }) status: ProductStatus;
  @ApiProperty({ nullable: true }) basePrice: number | null;
  @ApiProperty() currency: string;
  @ApiProperty() ratingAvg: number;
  @ApiProperty() ratingCount: number;
  @ApiProperty() categoryId: string;
  @ApiProperty({ nullable: true }) categoryName: string | null;
  @ApiProperty({ nullable: true }) brandId: string | null;
  @ApiProperty({ nullable: true }) brandName: string | null;

  static fromEntity(p: Product): ProductListItemDto {
    const dto = new ProductListItemDto();
    dto.id = p.id;
    dto.name = p.name;
    dto.slug = p.slug;
    dto.status = p.status;
    dto.basePrice = p.basePrice;
    dto.currency = p.currency;
    dto.ratingAvg = p.ratingAvg;
    dto.ratingCount = p.ratingCount;
    dto.categoryId = p.categoryId;
    dto.categoryName = p.category?.name ?? null;
    dto.brandId = p.brandId;
    dto.brandName = p.brand?.name ?? null;
    return dto;
  }
}
