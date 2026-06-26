import { ApiProperty } from '@nestjs/swagger';
import { CartStatus } from '../enums/cart-status.enum';

export class CartItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() variantId: string;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() lineTotal: number;
  @ApiProperty({ description: 'Available units from inventory' })
  available: number;
  @ApiProperty() inStock: boolean;
  @ApiProperty({
    description: 'Variant still purchasable (active + published)',
  })
  sellable: boolean;
  @ApiProperty({
    description: 'Snapshot price was refreshed to a new catalog price',
  })
  priceChanged: boolean;
  @ApiProperty({ description: 'A flash-sale price is currently applied' })
  onSale: boolean;
}

export class CartResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: CartStatus }) status: CartStatus;
  @ApiProperty() currency: string;
  @ApiProperty({ nullable: true }) couponCode: string | null;
  @ApiProperty({ type: [CartItemResponseDto] }) items: CartItemResponseDto[];
  @ApiProperty() itemCount: number;
  @ApiProperty({ description: 'Sum of line totals (pre-discount)' })
  subtotal: number;
  @ApiProperty({ description: 'Coupon discount applied to the subtotal' })
  discountTotal: number;
  @ApiProperty({ description: 'subtotal − discountTotal' })
  total: number;
  @ApiProperty({
    nullable: true,
    description: 'Set for guest carts so the client can persist it',
  })
  guestId: string | null;
}
