import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Payment } from '../entities/payment.entity';
import { Refund } from '../entities/refund.entity';
import { PaymentGateway } from '../enums/payment-gateway.enum';
import { PaymentState } from '../enums/payment-state.enum';

export class PaymentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() orderId: string;
  @ApiProperty({ enum: PaymentGateway }) gateway: PaymentGateway;
  @ApiProperty() amount: number;
  @ApiProperty() currency: string;
  @ApiProperty({ enum: PaymentState }) status: PaymentState;
  @ApiPropertyOptional({ nullable: true }) gatewayReference: string | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(payment: Payment): PaymentResponseDto {
    const dto = new PaymentResponseDto();
    dto.id = payment.id;
    dto.orderId = payment.orderId;
    dto.gateway = payment.gateway;
    dto.amount = payment.amount;
    dto.currency = payment.currency;
    dto.status = payment.status;
    dto.gatewayReference = payment.gatewayReference;
    dto.createdAt = payment.createdAt;
    return dto;
  }
}

/** Returned from `POST /payments/initiate`. */
export class InitiatePaymentResponseDto {
  @ApiProperty() paymentId: string;
  @ApiProperty({ enum: PaymentGateway }) gateway: PaymentGateway;
  @ApiProperty({ enum: PaymentState }) status: PaymentState;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Where to send the customer (online); null for COD',
  })
  redirectUrl: string | null;
}

export class RefundResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() orderId: string;
  @ApiProperty() amount: number;
  @ApiProperty({ enum: PaymentState }) status: PaymentState;
  @ApiPropertyOptional({ nullable: true }) gatewayRefundId: string | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(refund: Refund): RefundResponseDto {
    const dto = new RefundResponseDto();
    dto.id = refund.id;
    dto.orderId = refund.orderId;
    dto.amount = refund.amount;
    dto.status = refund.status;
    dto.gatewayRefundId = refund.gatewayRefundId;
    dto.createdAt = refund.createdAt;
    return dto;
  }
}
