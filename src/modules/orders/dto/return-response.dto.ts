import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderReturn } from '../entities/order-return.entity';
import { OrderReturnItem } from '../entities/order-return-item.entity';
import { ReturnStatus } from '../enums/return-status.enum';

export class ReturnItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() orderItemId: string;
  @ApiProperty() quantity: number;

  static fromEntity(item: OrderReturnItem): ReturnItemResponseDto {
    const dto = new ReturnItemResponseDto();
    dto.id = item.id;
    dto.orderItemId = item.orderItemId;
    dto.quantity = item.quantity;
    return dto;
  }
}

export class ReturnResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() orderId: string;
  @ApiProperty({ enum: ReturnStatus }) status: ReturnStatus;
  @ApiPropertyOptional({ nullable: true }) reason: string | null;
  @ApiProperty({ type: [ReturnItemResponseDto] })
  items: ReturnItemResponseDto[];
  @ApiProperty() createdAt: Date;

  static fromEntity(orderReturn: OrderReturn): ReturnResponseDto {
    const dto = new ReturnResponseDto();
    dto.id = orderReturn.id;
    dto.orderId = orderReturn.orderId;
    dto.status = orderReturn.status;
    dto.reason = orderReturn.reason;
    dto.items = (orderReturn.items ?? []).map((item) =>
      ReturnItemResponseDto.fromEntity(item),
    );
    dto.createdAt = orderReturn.createdAt;
    return dto;
  }
}
