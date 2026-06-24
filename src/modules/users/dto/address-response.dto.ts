import { ApiProperty } from '@nestjs/swagger';
import { Address } from '../entities/address.entity';

export class AddressResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) label: string | null;
  @ApiProperty() recipientName: string;
  @ApiProperty() phone: string;
  @ApiProperty() line1: string;
  @ApiProperty({ nullable: true }) line2: string | null;
  @ApiProperty() city: string;
  @ApiProperty({ nullable: true }) state: string | null;
  @ApiProperty({ nullable: true }) postalCode: string | null;
  @ApiProperty() country: string;
  @ApiProperty() isDefaultShipping: boolean;
  @ApiProperty() isDefaultBilling: boolean;
  @ApiProperty() createdAt: Date;

  static fromEntity(address: Address): AddressResponseDto {
    const dto = new AddressResponseDto();
    dto.id = address.id;
    dto.label = address.label;
    dto.recipientName = address.recipientName;
    dto.phone = address.phone;
    dto.line1 = address.line1;
    dto.line2 = address.line2;
    dto.city = address.city;
    dto.state = address.state;
    dto.postalCode = address.postalCode;
    dto.country = address.country;
    dto.isDefaultShipping = address.isDefaultShipping;
    dto.isDefaultBilling = address.isDefaultBilling;
    dto.createdAt = address.createdAt;
    return dto;
  }
}
