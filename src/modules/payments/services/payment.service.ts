import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { AuditAction, AuditService } from '../../audit';
import { OrderService } from '../../orders';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import {
  InitiatePaymentResponseDto,
  PaymentResponseDto,
  RefundResponseDto,
} from '../dto/payment-response.dto';
import { Payment } from '../entities/payment.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { PaymentGateway } from '../enums/payment-gateway.enum';
import { PaymentState } from '../enums/payment-state.enum';
import { PaymentTxnType } from '../enums/payment-txn-type.enum';
import { PaymentGatewayRegistry } from '../gateways/payment-gateway.registry';
import { VerifyResult } from '../gateways/payment-gateway.port';
import { PAYMENTS_STAFF_ROLES } from '../payments.constants';
import { PaymentRepository } from '../repositories/payment.repository';
import { RefundRepository } from '../repositories/refund.repository';

interface TxnInput {
  paymentId: string;
  type: PaymentTxnType;
  status: PaymentState;
  amount: number;
  gatewayTxnId?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly refundRepository: RefundRepository,
    @InjectRepository(PaymentTransaction)
    private readonly txnRepository: Repository<PaymentTransaction>,
    private readonly registry: PaymentGatewayRegistry,
    private readonly orderService: OrderService,
    private readonly auditService: AuditService,
  ) {}

  // --- initiate --------------------------------------------------------------

  async initiate(
    user: AuthenticatedUser,
    dto: InitiatePaymentDto,
  ): Promise<InitiatePaymentResponseDto> {
    const order = await this.orderService.getPayableOrder(dto.orderId, user.id);

    // Double-pay guard: resume an in-flight attempt rather than create a new one.
    const active = await this.paymentRepository.findActiveForOrder(order.id);
    if (active) {
      return this.toInitiateResponse(active);
    }

    const idempotencyKey =
      dto.idempotencyKey ?? `${order.id}:${dto.gateway}:${randomUUID()}`;

    if (dto.gateway === PaymentGateway.COD) {
      return this.initiateCod(user, order, idempotencyKey);
    }
    return this.initiateOnline(user, order, dto.gateway, idempotencyKey);
  }

  private async initiateCod(
    user: AuthenticatedUser,
    order: { id: string; grandTotal: number; currency: string },
    idempotencyKey: string,
  ): Promise<InitiatePaymentResponseDto> {
    // Confirm first (deducts stock; throws if the hold expired) so we never
    // leave a dangling COD payment for an order we couldn't commit.
    await this.orderService.confirmOrder(order.id, user.id);

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        orderId: order.id,
        userId: user.id,
        gateway: PaymentGateway.COD,
        amount: order.grandTotal,
        currency: order.currency,
        status: PaymentState.PENDING, // collected on delivery
        idempotencyKey,
        createdBy: user.id,
        updatedBy: user.id,
      }),
    );
    await this.writeTxn({
      paymentId: payment.id,
      type: PaymentTxnType.CHARGE,
      status: PaymentState.PENDING,
      amount: order.grandTotal,
      rawPayload: { cod: true },
    });
    this.audit(AuditAction.PAYMENT_INITIATED, user.id, payment);
    return this.toInitiateResponse(payment);
  }

  private async initiateOnline(
    user: AuthenticatedUser,
    order: { id: string; grandTotal: number; currency: string },
    gateway: PaymentGateway,
    idempotencyKey: string,
  ): Promise<InitiatePaymentResponseDto> {
    const adapter = this.registry.for(gateway);
    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        orderId: order.id,
        userId: user.id,
        gateway,
        amount: order.grandTotal,
        currency: order.currency,
        status: PaymentState.INITIATED,
        idempotencyKey,
        createdBy: user.id,
        updatedBy: user.id,
      }),
    );

    let redirectUrl: string | null = null;
    try {
      const result = await adapter.initiate({
        paymentId: payment.id,
        orderId: order.id,
        amount: order.grandTotal,
        currency: order.currency,
        customerEmail: user.email,
      });
      payment.gatewayReference = result.gatewayReference;
      payment.status = result.status;
      redirectUrl = result.redirectUrl;
      await this.paymentRepository.save(payment);
      await this.writeTxn({
        paymentId: payment.id,
        type: PaymentTxnType.CHARGE,
        status: result.status,
        amount: order.grandTotal,
        rawPayload: { redirectUrl: result.redirectUrl },
      });
    } catch (err) {
      payment.status = PaymentState.FAILED;
      await this.paymentRepository.save(payment);
      this.logger.error(
        `Gateway initiate failed for ${gateway}: ${String(err)}`,
      );
      throw err;
    }

    this.audit(AuditAction.PAYMENT_INITIATED, user.id, payment);
    return this.toInitiateResponse(payment, redirectUrl);
  }

  // --- webhook / callback ----------------------------------------------------

  /** Handle an inbound gateway webhook: verify, dedupe, settle. */
  async handleWebhook(
    gateway: PaymentGateway,
    payload: Record<string, unknown>,
  ): Promise<{ received: true; duplicate: boolean }> {
    const adapter = this.registry.for(gateway);
    const verified = await adapter.verifyCallback(payload); // throws 401 on bad sig

    const reference =
      typeof payload.gatewayReference === 'string'
        ? payload.gatewayReference
        : '';
    const payment =
      await this.paymentRepository.findByGatewayReference(reference);
    if (!payment) {
      throw new NotFoundException(`No payment for reference ${reference}`);
    }
    const settled = await this.settle(
      payment,
      verified,
      PaymentTxnType.WEBHOOK,
    );
    return { received: true, duplicate: !settled };
  }

  /**
   * Apply a verified outcome to a payment exactly once. Returns true if it
   * settled, false if it was a duplicate/no-op. On SUCCESS it confirms the order
   * (deduct stock) via OrderService before recording the payment as settled.
   */
  private async settle(
    payment: Payment,
    verified: VerifyResult,
    txnType: PaymentTxnType,
  ): Promise<boolean> {
    if (payment.status === PaymentState.SUCCESS) return false; // already settled

    if (verified.status === PaymentState.SUCCESS) {
      // Confirm the order first; if the reservation expired this throws and we
      // leave the payment unsettled so the gateway can retry / reconcile.
      await this.orderService.markPaid(payment.orderId, payment.userId);
    }

    try {
      await this.writeTxn({
        paymentId: payment.id,
        type: txnType,
        status: verified.status,
        amount: verified.amount ?? payment.amount,
        gatewayTxnId: verified.gatewayTxnId,
        rawPayload: verified.raw,
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return false; // concurrent duplicate webhook
      throw err;
    }

    payment.status = verified.status;
    await this.paymentRepository.save(payment);

    if (verified.status === PaymentState.SUCCESS) {
      this.logger.log(
        `order.paid order=${payment.orderId} payment=${payment.id}`,
      );
      this.audit(AuditAction.PAYMENT_SUCCEEDED, payment.userId, payment);
    }
    return true;
  }

  // --- reconciliation (edge #2) ---------------------------------------------

  /** Poll stuck online payments and settle dropped callbacks. */
  async reconcile(olderThan: Date, batch: number): Promise<number> {
    const stuck = await this.paymentRepository.findStuck(olderThan, batch);
    let recovered = 0;
    for (const payment of stuck) {
      if (
        payment.gateway === PaymentGateway.COD ||
        !payment.gatewayReference ||
        !this.registry.supports(payment.gateway)
      ) {
        continue;
      }
      try {
        const adapter = this.registry.for(payment.gateway);
        const verified = await adapter.fetchStatus(payment.gatewayReference);
        if (
          verified.status === PaymentState.SUCCESS ||
          verified.status === PaymentState.FAILED
        ) {
          const settled = await this.settle(
            payment,
            verified,
            PaymentTxnType.CALLBACK,
          );
          if (settled) recovered++;
        }
      } catch (err) {
        this.logger.error(
          `Reconcile failed for payment ${payment.id}: ${String(err)}`,
        );
      }
    }
    if (recovered > 0) {
      this.logger.warn(`Reconciliation recovered ${recovered} payment(s)`);
    }
    return recovered;
  }

  // --- reads -----------------------------------------------------------------

  async getForOrder(
    user: AuthenticatedUser,
    orderId: string,
  ): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository.findByOrder(orderId);
    const visible = this.isStaff(user)
      ? payments
      : payments.filter((p) => p.userId === user.id);
    return visible.map((p) => PaymentResponseDto.fromEntity(p));
  }

  // --- refund (staff) --------------------------------------------------------

  async refund(
    staff: AuthenticatedUser,
    dto: RefundPaymentDto,
  ): Promise<RefundResponseDto> {
    const payment = await this.paymentRepository.findSuccessfulForOrder(
      dto.orderId,
    );
    if (!payment) {
      throw new NotFoundException(
        `No successful payment to refund for order ${dto.orderId}`,
      );
    }
    const amount = dto.amount ?? payment.amount;
    if (amount > payment.amount) {
      throw new BadRequestException('Refund exceeds the captured amount');
    }

    const refund = await this.refundRepository.save(
      this.refundRepository.create({
        paymentId: payment.id,
        orderId: dto.orderId,
        amount,
        reason: dto.reason ?? null,
        status: PaymentState.PENDING,
      }),
    );

    let gatewayRefundId: string;
    if (payment.gateway === PaymentGateway.COD) {
      gatewayRefundId = `COD-RF-${refund.id}`; // manual cash refund, recorded only
    } else {
      const result = await this.registry.for(payment.gateway).refund({
        paymentId: payment.id,
        gatewayReference: payment.gatewayReference,
        amount,
        reason: dto.reason,
      });
      gatewayRefundId = result.gatewayRefundId;
    }

    refund.status = PaymentState.REFUNDED;
    refund.gatewayRefundId = gatewayRefundId;
    await this.refundRepository.save(refund);

    const fullRefund = amount >= payment.amount;
    if (fullRefund) {
      payment.status = PaymentState.REFUNDED;
      await this.paymentRepository.save(payment);
    }
    await this.writeTxn({
      paymentId: payment.id,
      type: PaymentTxnType.REFUND,
      status: PaymentState.REFUNDED,
      amount,
      gatewayTxnId: gatewayRefundId,
    });

    // Reconcile the order's payment_status (payments → orders, one-way; D36).
    await this.orderService.applyRefund(dto.orderId, amount, staff.id);

    this.audit(AuditAction.PAYMENT_REFUNDED, staff.id, payment, { amount });
    return RefundResponseDto.fromEntity(refund);
  }

  // --- COD capture (staff, on delivery) --------------------------------------

  async captureCod(
    staff: AuthenticatedUser,
    paymentId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    if (payment.gateway !== PaymentGateway.COD) {
      throw new BadRequestException('Only COD payments are captured manually');
    }
    if (payment.status === PaymentState.SUCCESS) {
      return PaymentResponseDto.fromEntity(payment); // idempotent
    }
    if (payment.status !== PaymentState.PENDING) {
      throw new ConflictException(
        `COD payment in ${payment.status} cannot be captured`,
      );
    }

    payment.status = PaymentState.SUCCESS;
    payment.updatedBy = staff.id;
    await this.paymentRepository.save(payment);
    await this.writeTxn({
      paymentId: payment.id,
      type: PaymentTxnType.CHARGE,
      status: PaymentState.SUCCESS,
      amount: payment.amount,
      gatewayTxnId: `COD-COLLECT-${payment.id}`,
    });
    await this.orderService.recordPaymentCaptured(payment.orderId, staff.id);
    this.audit(AuditAction.PAYMENT_SUCCEEDED, staff.id, payment);
    return PaymentResponseDto.fromEntity(payment);
  }

  // --- helpers ---------------------------------------------------------------

  private writeTxn(input: TxnInput): Promise<PaymentTransaction> {
    return this.txnRepository.save(
      this.txnRepository.create({
        paymentId: input.paymentId,
        type: input.type,
        status: input.status,
        amount: input.amount,
        gatewayTxnId: input.gatewayTxnId ?? null,
        rawPayload: input.rawPayload ?? null,
      }),
    );
  }

  private toInitiateResponse(
    payment: Payment,
    redirectUrl: string | null = null,
  ): InitiatePaymentResponseDto {
    const dto = new InitiatePaymentResponseDto();
    dto.paymentId = payment.id;
    dto.gateway = payment.gateway;
    dto.status = payment.status;
    dto.redirectUrl =
      redirectUrl ??
      (payment.gateway !== PaymentGateway.COD && payment.gatewayReference
        ? `/mock-pay/${payment.gatewayReference}`
        : null);
    return dto;
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string })?.code === '23505'
    );
  }

  private isStaff(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      (PAYMENTS_STAFF_ROLES as readonly string[]).includes(role),
    );
  }

  private audit(
    action: string,
    actorId: string | null,
    payment: Payment,
    extra?: Record<string, unknown>,
  ): void {
    void this.auditService.record({
      action,
      actorId,
      targetType: 'payment',
      targetId: payment.id,
      metadata: {
        orderId: payment.orderId,
        gateway: payment.gateway,
        amount: payment.amount,
        ...extra,
      },
    });
  }
}
