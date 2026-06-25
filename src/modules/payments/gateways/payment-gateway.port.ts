import { PaymentGateway } from '../enums/payment-gateway.enum';
import { PaymentState } from '../enums/payment-state.enum';

/** Input to start a charge with an online gateway. */
export interface InitiateInput {
  paymentId: string;
  orderId: string;
  orderNumber?: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
}

export interface InitiateResult {
  gatewayReference: string;
  /** Where to send the customer to complete payment (online). */
  redirectUrl: string | null;
  /** INITIATED or PENDING — the charge is not yet settled. */
  status: PaymentState;
}

/** Normalized outcome parsed from a webhook/callback or a status poll. */
export interface VerifyResult {
  gatewayTxnId: string;
  status: PaymentState; // SUCCESS | FAILED | PENDING
  amount: number | null;
  raw: Record<string, unknown>;
}

export interface RefundInput {
  paymentId: string;
  gatewayReference: string | null;
  amount: number;
  reason?: string | null;
}

export interface RefundResult {
  gatewayRefundId: string;
  status: PaymentState; // SUCCESS
}

/**
 * Swappable payment-gateway port. Each online gateway (MOCK now; bKash/Nagad/
 * Rocket/SSLCommerz/ShurjoPay later) implements this; only the adapter imports
 * the vendor SDK. COD is handled directly by the service (no online charge).
 */
export interface PaymentGatewayAdapter {
  readonly gateway: PaymentGateway;
  initiate(input: InitiateInput): Promise<InitiateResult>;
  /** Parse + verify an inbound webhook/callback payload (throws on bad signature). */
  verifyCallback(payload: Record<string, unknown>): Promise<VerifyResult>;
  /** Poll current status for reconciliation (edge case #2). */
  fetchStatus(gatewayReference: string): Promise<VerifyResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}
