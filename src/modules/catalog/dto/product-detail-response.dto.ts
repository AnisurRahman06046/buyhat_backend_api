import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '../enums/product-status.enum';
import { Product } from '../entities/product.entity';
import { MediaResponseDto } from './media-response.dto';
import { VariantResponseDto } from './variant-response.dto';

export class ProductAttributeResponseDto {
  @ApiProperty() attributeId: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) optionId: string | null;
  @ApiProperty({ nullable: true }) valueText: string | null;
}

export class ProductDetailResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ enum: ProductStatus }) status: ProductStatus;
  @ApiProperty({ nullable: true }) basePrice: number | null;
  @ApiProperty() currency: string;
  @ApiProperty() ratingAvg: number;
  @ApiProperty() ratingCount: number;
  @ApiProperty() category: { id: string; name: string; slug: string };
  @ApiProperty({ nullable: true })
  brand: { id: string; name: string; slug: string } | null;
  @ApiProperty({ type: [ProductAttributeResponseDto] })
  attributes: ProductAttributeResponseDto[];
  @ApiProperty({ type: [VariantResponseDto] })
  variants: VariantResponseDto[];
  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[];

  static fromEntity(p: Product): ProductDetailResponseDto {
    const dto = new ProductDetailResponseDto();
    dto.id = p.id;
    dto.name = p.name;
    dto.slug = p.slug;
    dto.description = p.description;
    dto.status = p.status;
    dto.basePrice = p.basePrice;
    dto.currency = p.currency;
    dto.ratingAvg = p.ratingAvg;
    dto.ratingCount = p.ratingCount;
    dto.category = p.category
      ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
      : { id: p.categoryId, name: '', slug: '' };
    dto.brand = p.brand
      ? { id: p.brand.id, name: p.brand.name, slug: p.brand.slug }
      : null;
    dto.attributes = (p.attributeValues ?? []).map((av) => ({
      attributeId: av.attributeId,
      code: av.attribute?.code,
      name: av.attribute?.name,
      optionId: av.optionId,
      valueText: av.valueText,
    }));
    dto.variants = (p.variants ?? []).map((v) =>
      VariantResponseDto.fromEntity(v),
    );
    dto.media = (p.media ?? [])
      .slice()
      .sort(
        (a, b) =>
          Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position,
      )
      .map((m) => MediaResponseDto.fromEntity(m));
    return dto;
  }
}
