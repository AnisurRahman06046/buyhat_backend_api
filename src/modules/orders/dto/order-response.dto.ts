import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Order } from '../entities/order.entity';
import { OrderAddress } from '../entities/order-address.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderAddressType } from '../enums/order-address-type.enum';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export class OrderItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() variantId: string;
  @ApiProperty() productId: string;
  @ApiProperty() sku: string;
  @ApiProperty() productName: string;
  @ApiPropertyOptional({ nullable: true }) variantLabel: string | null;
  @ApiProperty() unitPrice: number;
  @ApiProperty() quantity: number;
  @ApiProperty() lineTotal: number;
  /** Current primary image of the product (resolved at read time, not snapshotted). */
  @ApiPropertyOptional({ nullable: true }) imageUrl: string | null = null;

  static fromEntity(item: OrderItem): OrderItemResponseDto {
    const dto = new OrderItemResponseDto();
    dto.id = item.id;
    dto.variantId = item.variantId;
    dto.productId = item.productId;
    dto.sku = item.skuSnapshot;
    dto.productName = item.productNameSnapshot;
    dto.variantLabel = item.variantLabelSnapshot;
    dto.unitPrice = item.unitPrice;
    dto.quantity = item.quantity;
    dto.lineTotal = item.lineTotal;
    return dto;
  }
}

export class OrderAddressResponseDto {
  @ApiProperty({ enum: OrderAddressType }) type: OrderAddressType;
  @ApiProperty() recipientName: string;
  @ApiProperty() phone: string;
  @ApiProperty() line1: string;
  @ApiPropertyOptional({ nullable: true }) line2: string | null;
  @ApiProperty() city: string;
  @ApiPropertyOptional({ nullable: true }) state: string | null;
  @ApiPropertyOptional({ nullable: true }) postalCode: string | null;
  @ApiProperty() country: string;

  static fromEntity(address: OrderAddress): OrderAddressResponseDto {
    const dto = new OrderAddressResponseDto();
    dto.type = address.type;
    dto.recipientName = address.recipientName;
    dto.phone = address.phone;
    dto.line1 = address.line1;
    dto.line2 = address.line2;
    dto.city = address.city;
    dto.state = address.state;
    dto.postalCode = address.postalCode;
    dto.country = address.country;
    return dto;
  }
}

export class OrderStatusHistoryDto {
  @ApiPropertyOptional({ enum: OrderStatus, nullable: true })
  fromStatus: OrderStatus | null;
  @ApiProperty({ enum: OrderStatus }) toStatus: OrderStatus;
  @ApiPropertyOptional({ nullable: true }) note: string | null;
  @ApiProperty() changedAt: Date;

  static fromEntity(history: OrderStatusHistory): OrderStatusHistoryDto {
    const dto = new OrderStatusHistoryDto();
    dto.fromStatus = history.fromStatus;
    dto.toStatus = history.toStatus;
    dto.note = history.note;
    dto.changedAt = history.createdAt;
    return dto;
  }
}

export class OrderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() orderNumber: string;
  @ApiPropertyOptional({ nullable: true }) userId: string | null;
  /** Customer display name (profile name → guest email), resolved at read time. */
  @ApiPropertyOptional({ nullable: true }) customerName: string | null = null;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ enum: PaymentStatus }) paymentStatus: PaymentStatus;
  @ApiProperty() currency: string;
  @ApiProperty() subtotal: number;
  @ApiProperty() discountTotal: number;
  @ApiProperty() shippingTotal: number;
  @ApiProperty() taxTotal: number;
  @ApiProperty() grandTotal: number;
  @ApiPropertyOptional({ nullable: true }) couponCode: string | null;
  @ApiPropertyOptional({ nullable: true }) placedAt: Date | null;
  @ApiProperty() itemCount: number;
  @ApiProperty({ type: [OrderItemResponseDto] }) items: OrderItemResponseDto[];
  @ApiPropertyOptional({ type: [OrderAddressResponseDto] })
  addresses?: OrderAddressResponseDto[];
  @ApiPropertyOptional({ type: [OrderStatusHistoryDto] })
  statusHistory?: OrderStatusHistoryDto[];
  @ApiProperty() createdAt: Date;

  static fromEntity(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.orderNumber = order.orderNumber;
    dto.userId = order.userId;
    dto.status = order.status;
    dto.paymentStatus = order.paymentStatus;
    dto.currency = order.currency;
    dto.subtotal = order.subtotal;
    dto.discountTotal = order.discountTotal;
    dto.shippingTotal = order.shippingTotal;
    dto.taxTotal = order.taxTotal;
    dto.grandTotal = order.grandTotal;
    dto.couponCode = order.couponCode;
    dto.placedAt = order.placedAt;
    const items = order.items ?? [];
    dto.items = items.map((item) => OrderItemResponseDto.fromEntity(item));
    dto.itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    if (order.addresses) {
      dto.addresses = order.addresses.map((a) =>
        OrderAddressResponseDto.fromEntity(a),
      );
    }
    if (order.statusHistory) {
      dto.statusHistory = order.statusHistory.map((h) =>
        OrderStatusHistoryDto.fromEntity(h),
      );
    }
    dto.createdAt = order.createdAt;
    return dto;
  }
}
