import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AddressInputDto } from './address-input.dto';

/**
 * Checkout payload. Provide a shipping address either by `shippingAddressId`
 * (a saved address, snapshotted) or inline via `shippingAddress`. Billing is
 * optional and defaults to the shipping address.
 */
export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'A saved address id to snapshot' })
  @IsOptional()
  @IsUUID()
  shippingAddressId?: string;

  @ApiPropertyOptional({ type: AddressInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInputDto)
  shippingAddress?: AddressInputDto;

  @ApiPropertyOptional({ description: 'A saved address id to snapshot' })
  @IsOptional()
  @IsUUID()
  billingAddressId?: string;

  @ApiPropertyOptional({ type: AddressInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInputDto)
  billingAddress?: AddressInputDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNote?: string;
}
