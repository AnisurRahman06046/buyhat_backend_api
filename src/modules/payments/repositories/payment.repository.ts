import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Payment } from '../entities/payment.entity';
import { PaymentState } from '../enums/payment-state.enum';

@Injectable()
export class PaymentRepository extends BaseRepository<Payment> {
  constructor(
    @InjectRepository(Payment)
    repo: Repository<Payment>,
  ) {
    super(repo);
  }

  findByOrder(orderId: string): Promise<Payment[]> {
    return this.findMany({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  findByGatewayReference(reference: string): Promise<Payment | null> {
    return this.findOne({ where: { gatewayReference: reference } });
  }

  /** An in-flight or already-successful payment for an order (double-pay guard). */
  findActiveForOrder(orderId: string): Promise<Payment | null> {
    return this.findOne({
      where: {
        orderId,
        status: In([
          PaymentState.INITIATED,
          PaymentState.PENDING,
          PaymentState.SUCCESS,
        ]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** A successful payment for an order (refund target). */
  findSuccessfulForOrder(orderId: string): Promise<Payment | null> {
    return this.findOne({
      where: { orderId, status: PaymentState.SUCCESS },
      order: { createdAt: 'DESC' },
    });
  }

  /** Stuck online payments past the cutoff, for the reconciliation sweep. */
  findStuck(olderThan: Date, limit: number): Promise<Payment[]> {
    return this.findMany({
      where: {
        status: In([PaymentState.INITIATED, PaymentState.PENDING]),
        createdAt: LessThan(olderThan),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }
}
