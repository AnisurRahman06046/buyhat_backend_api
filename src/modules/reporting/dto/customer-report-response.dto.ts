import { ApiProperty } from '@nestjs/swagger';

/** Customers report: totals over the window. */
export class CustomerReportDto {
  @ApiProperty({ type: String, format: 'date-time' }) from: Date;
  @ApiProperty({ type: String, format: 'date-time' }) to: Date;
  @ApiProperty() totalCustomers: number;
  @ApiProperty({ description: 'Registered within the window' })
  newCustomers: number;
  @ApiProperty({ description: 'Customers with ≥2 committed orders' })
  repeatCustomers: number;
}
