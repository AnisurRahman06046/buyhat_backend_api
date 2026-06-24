import { Module } from '@nestjs/common';

/**
 * Payments module — payment intents, transactions and gateway adapters
 * (Stripe/PayPal/etc.) behind a provider port. Owns schema `payments`.
 * Webhooks reconcile asynchronous gateway events back onto orders.
 *
 * Skeleton only.
 */
@Module({})
export class PaymentsModule {}
