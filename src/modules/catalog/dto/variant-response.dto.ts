import { ApiProperty } from '@nestjs/swagger';
import { ProductVariant } from '../entities/product-variant.entity';

export class VariantAttributeResponseDto {
  @ApiProperty() attributeId: string;
  @ApiProperty() attributeCode: string;
  @ApiProperty() attributeName: string;
  @ApiProperty() optionId: string;
  @ApiProperty() value: string;
  @ApiProperty({ nullable: true }) label: string | null;
}

export class VariantResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() sku: string;
  @ApiProperty({ nullable: true }) barcode: string | null;
  @ApiProperty() price: number;
  @ApiProperty({ nullable: true }) compareAtPrice: number | null;
  @ApiProperty({ nullable: true }) weight: number | null;
  @ApiProperty() weightUnit: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: [VariantAttributeResponseDto] })
  attributes: VariantAttributeResponseDto[];

  static fromEntity(v: ProductVariant): VariantResponseDto {
    const dto = new VariantResponseDto();
    dto.id = v.id;
    dto.sku = v.sku;
    dto.barcode = v.barcode;
    dto.price = v.price;
    dto.compareAtPrice = v.compareAtPrice;
    dto.weight = v.weight;
    dto.weightUnit = v.weightUnit;
    dto.isActive = v.isActive;
    dto.attributes = (v.attributeValues ?? []).map((av) => ({
      attributeId: av.attributeId,
      attributeCode: av.attribute?.code,
      attributeName: av.attribute?.name,
      optionId: av.optionId,
      value: av.option?.value,
      label: av.option?.label ?? null,
    }));
    return dto;
  }
}
