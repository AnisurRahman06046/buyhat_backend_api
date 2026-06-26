import { ApiProperty } from '@nestjs/swagger';
import { SalesGranularity } from '../enums/sales-granularity.enum';

/** One time bucket of the sales report. */
export class SalesPeriodDto {
  @ApiProperty({ type: String, format: 'date-time' }) period: Date;
  @ApiProperty() orders: number;
  @ApiProperty() grossRevenue: number;
  @ApiProperty() discountTotal: number;
  @ApiProperty() refundedTotal: number;
  @ApiProperty() netRevenue: number;
  @ApiProperty() itemsSold: number;
}

/** Sales report: per-period buckets plus window totals. */
export class SalesReportDto {
  @ApiProperty({ type: String, format: 'date-time' }) from: Date;
  @ApiProperty({ type: String, format: 'date-time' }) to: Date;
  @ApiProperty({ enum: SalesGranularity }) granularity: SalesGranularity;
  @ApiProperty({ type: [SalesPeriodDto] }) periods: SalesPeriodDto[];
  @ApiProperty() totalOrders: number;
  @ApiProperty() totalGrossRevenue: number;
  @ApiProperty() totalNetRevenue: number;
  @ApiProperty() totalItemsSold: number;
}
