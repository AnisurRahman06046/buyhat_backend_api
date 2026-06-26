import { ApiProperty } from '@nestjs/swagger';
import { StockItem } from '../entities/stock-item.entity';

/** A single stock line in the low/out-of-stock report. */
export class StockReportLineDto {
  @ApiProperty() variantId: string;
  @ApiProperty() onHand: number;
  @ApiProperty() reserved: number;
  @ApiProperty() available: number;
  @ApiProperty() reorderLevel: number;

  static fromEntity(item: StockItem): StockReportLineDto {
    const dto = new StockReportLineDto();
    dto.variantId = item.variantId;
    dto.onHand = item.quantityOnHand;
    dto.reserved = item.quantityReserved;
    dto.available = item.quantityOnHand - item.quantityReserved;
    dto.reorderLevel = item.reorderLevel;
    return dto;
  }
}

/** Inventory health snapshot: counts + sampled lines for low / out of stock. */
export class StockReportDto {
  @ApiProperty() outOfStockCount: number;
  @ApiProperty() lowStockCount: number;
  @ApiProperty({ type: [StockReportLineDto] }) outOfStock: StockReportLineDto[];
  @ApiProperty({ type: [StockReportLineDto] }) lowStock: StockReportLineDto[];
}
