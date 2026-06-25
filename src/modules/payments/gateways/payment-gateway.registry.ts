import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentGateway } from '../enums/payment-gateway.enum';
import { MockGateway } from './mock.gateway';
import { PaymentGatewayAdapter } from './payment-gateway.port';

/**
 * Resolves a `PaymentGateway` to its online adapter. Register new adapters here
 * (and in the module providers) — the rest of the system is gateway-agnostic.
 * COD has no online adapter; it is handled directly by `PaymentService`.
 */
@Injectable()
export class PaymentGatewayRegistry {
  private readonly adapters: Map<PaymentGateway, PaymentGatewayAdapter>;

  constructor(mock: MockGateway) {
    this.adapters = new Map<PaymentGateway, PaymentGatewayAdapter>([
      [mock.gateway, mock],
    ]);
  }

  supports(gateway: PaymentGateway): boolean {
    return this.adapters.has(gateway);
  }

  for(gateway: PaymentGateway): PaymentGatewayAdapter {
    const adapter = this.adapters.get(gateway);
    if (!adapter) {
      throw new BadRequestException(
        `Payment gateway ${gateway} is not supported`,
      );
    }
    return adapter;
  }
}
