import { ApiProperty } from '@nestjs/swagger';
import { StockItem } from '../entities/stock-item.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockReservation } from '../entities/stock-reservation.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';
import { StockMovementType } from '../enums/stock-movement-type.enum';

export class StockAvailabilityDto {
  @ApiProperty() variantId: string;
  @ApiProperty() onHand: number;
  @ApiProperty() reserved: number;
  @ApiProperty() available: number;
  @ApiProperty() reorderLevel: number;
  @ApiProperty() lowStock: boolean;

  static fromEntity(item: StockItem): StockAvailabilityDto {
    const dto = new StockAvailabilityDto();
    dto.variantId = item.variantId;
    dto.onHand = item.quantityOnHand;
    dto.reserved = item.quantityReserved;
    dto.available = item.quantityOnHand - item.quantityReserved;
    dto.reorderLevel = item.reorderLevel;
    dto.lowStock = dto.available <= item.reorderLevel;
    return dto;
  }

  /** A variant with no stock_item yet reads as all-zero. */
  static empty(variantId: string): StockAvailabilityDto {
    const dto = new StockAvailabilityDto();
    dto.variantId = variantId;
    dto.onHand = 0;
    dto.reserved = 0;
    dto.available = 0;
    dto.reorderLevel = 0;
    dto.lowStock = true;
    return dto;
  }
}

export class MovementResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() variantId: string;
  @ApiProperty({ enum: StockMovementType }) type: StockMovementType;
  @ApiProperty() quantity: number;
  @ApiProperty() balanceAfter: number;
  @ApiProperty({ nullable: true }) referenceType: string | null;
  @ApiProperty({ nullable: true }) referenceId: string | null;
  @ApiProperty({ nullable: true }) reason: string | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(m: StockMovement): MovementResponseDto {
    const dto = new MovementResponseDto();
    dto.id = m.id;
    dto.variantId = m.variantId;
    dto.type = m.type;
    dto.quantity = m.quantity;
    dto.balanceAfter = m.balanceAfter;
    dto.referenceType = m.referenceType;
    dto.referenceId = m.referenceId;
    dto.reason = m.reason;
    dto.createdAt = m.createdAt;
    return dto;
  }
}

export class ReservationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() variantId: string;
  @ApiProperty() quantity: number;
  @ApiProperty({ enum: ReservationStatus }) status: ReservationStatus;
  @ApiProperty({ nullable: true }) cartId: string | null;
  @ApiProperty({ nullable: true }) orderId: string | null;
  @ApiProperty() expiresAt: Date;

  static fromEntity(r: StockReservation): ReservationResponseDto {
    const dto = new ReservationResponseDto();
    dto.id = r.id;
    dto.variantId = r.variantId;
    dto.quantity = r.quantity;
    dto.status = r.status;
    dto.cartId = r.cartId;
    dto.orderId = r.orderId;
    dto.expiresAt = r.expiresAt;
    return dto;
  }
}
