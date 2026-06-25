import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders';
import { PaymentController } from './controllers/payment.controller';
import { Payment } from './entities/payment.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { Refund } from './entities/refund.entity';
import { MockGateway } from './gateways/mock.gateway';
import { PaymentGatewayRegistry } from './gateways/payment-gateway.registry';
import { PaymentRepository } from './repositories/payment.repository';
import { RefundRepository } from './repositories/refund.repository';
import { PaymentReconciliationService } from './services/payment-reconciliation.service';
import { PaymentService } from './services/payment.service';

/**
 * `payments` feature module — gateway-agnostic payments behind the
 * `PAYMENT_GATEWAY` port (COD + MOCK now). Confirms/deducts stock and reconciles
 * order payment_status via `OrderService` (one-way payments → orders), runs a
 * reconciliation sweep for dropped callbacks. `AuditService` is global.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentTransaction, Refund]),
    OrdersModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentRepository,
    RefundRepository,
    MockGateway,
    PaymentGatewayRegistry,
    PaymentService,
    PaymentReconciliationService,
  ],
  exports: [PaymentService],
})
export class PaymentsModule {}
