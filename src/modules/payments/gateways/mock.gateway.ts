import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGateway } from '../enums/payment-gateway.enum';
import { PaymentState } from '../enums/payment-state.enum';
import {
  InitiateInput,
  InitiateResult,
  PaymentGatewayAdapter,
  RefundInput,
  RefundResult,
  VerifyResult,
} from './payment-gateway.port';

/**
 * A self-contained online gateway for dev/test. It exercises the full
 * initiate → redirect → signed-webhook → reconcile machinery without any
 * network calls, and is the template a real adapter (bKash/SSLCommerz/…) slots
 * into. Webhooks are authenticated with an HMAC-SHA256 signature over a
 * canonical string using `payments.mockSecret`.
 */
@Injectable()
export class MockGateway implements PaymentGatewayAdapter {
  readonly gateway = PaymentGateway.MOCK;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('payments.mockSecret') ?? 'mock-secret';
  }

  /** Canonical signing string for a webhook payload. */
  static canonical(
    gatewayReference: string,
    gatewayTxnId: string,
    status: string,
    amount: number,
  ): string {
    return `${gatewayReference}|${gatewayTxnId}|${status}|${amount}`;
  }

  /** Sign a payload as the gateway would — also used by tests/clients. */
  static sign(
    secret: string,
    gatewayReference: string,
    gatewayTxnId: string,
    status: string,
    amount: number,
  ): string {
    return createHmac('sha256', secret)
      .update(
        MockGateway.canonical(gatewayReference, gatewayTxnId, status, amount),
      )
      .digest('hex');
  }

  initiate(input: InitiateInput): Promise<InitiateResult> {
    const gatewayReference = `MOCK-${input.paymentId}`;
    return Promise.resolve({
      gatewayReference,
      redirectUrl: `/mock-pay/${gatewayReference}`,
      status: PaymentState.PENDING,
    });
  }

  verifyCallback(payload: Record<string, unknown>): Promise<VerifyResult> {
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const gatewayReference = str(payload.gatewayReference);
    const gatewayTxnId = str(payload.gatewayTxnId);
    const status = str(payload.status);
    const amount = Number(payload.amount ?? 0);
    const signature = str(payload.signature);

    const expected = MockGateway.sign(
      this.secret,
      gatewayReference,
      gatewayTxnId,
      status,
      amount,
    );
    if (!this.safeEqual(signature, expected)) {
      // Rejected promise (not a sync throw) so the rejection is consistent for
      // both `await`ing callers and `.rejects` assertions.
      return Promise.reject(
        new UnauthorizedException('Invalid webhook signature'),
      );
    }
    if (!gatewayReference || !gatewayTxnId) {
      return Promise.reject(
        new UnauthorizedException('Malformed webhook payload'),
      );
    }

    return Promise.resolve({
      gatewayTxnId,
      status: status === 'SUCCESS' ? PaymentState.SUCCESS : PaymentState.FAILED,
      amount,
      raw: payload,
    });
  }

  /**
   * Reconciliation poll. The mock assumes the charge succeeded (the realistic
   * "payment ok but callback dropped" case, edge #2) and returns a deterministic
   * txn id so it dedupes against any later webhook.
   */
  fetchStatus(gatewayReference: string): Promise<VerifyResult> {
    return Promise.resolve({
      gatewayTxnId: `${gatewayReference}-TXN`,
      status: PaymentState.SUCCESS,
      amount: null,
      raw: { reconciled: true, gatewayReference },
    });
  }

  refund(input: RefundInput): Promise<RefundResult> {
    return Promise.resolve({
      gatewayRefundId: `MOCK-RF-${input.paymentId}`,
      status: PaymentState.SUCCESS,
    });
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}
