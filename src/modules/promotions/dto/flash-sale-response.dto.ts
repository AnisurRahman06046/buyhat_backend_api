import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlashSale } from '../entities/flash-sale.entity';
import { FlashSaleItem } from '../entities/flash-sale-item.entity';
import { FlashSaleStatus } from '../enums/flash-sale-status.enum';

export class FlashSaleItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() variantId: string;
  @ApiProperty() productId: string;
  @ApiProperty() salePrice: number;
  @ApiPropertyOptional({ nullable: true }) quantityLimit: number | null;
  @ApiProperty() soldCount: number;

  static fromEntity(item: FlashSaleItem): FlashSaleItemResponseDto {
    const dto = new FlashSaleItemResponseDto();
    dto.id = item.id;
    dto.variantId = item.variantId;
    dto.productId = item.productId;
    dto.salePrice = item.salePrice;
    dto.quantityLimit = item.quantityLimit;
    dto.soldCount = item.soldCount;
    return dto;
  }
}

export class FlashSaleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() startsAt: Date;
  @ApiProperty() endsAt: Date;
  @ApiProperty({ enum: FlashSaleStatus }) status: FlashSaleStatus;
  @ApiProperty({ type: [FlashSaleItemResponseDto] })
  items: FlashSaleItemResponseDto[];

  static fromEntity(sale: FlashSale): FlashSaleResponseDto {
    const dto = new FlashSaleResponseDto();
    dto.id = sale.id;
    dto.name = sale.name;
    dto.startsAt = sale.startsAt;
    dto.endsAt = sale.endsAt;
    dto.status = sale.status;
    dto.items = (sale.items ?? []).map((i) =>
      FlashSaleItemResponseDto.fromEntity(i),
    );
    return dto;
  }
}
