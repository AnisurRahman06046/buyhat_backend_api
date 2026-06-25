/**
 * Public API of the `payments` module. Other modules integrate via
 * `PaymentService` — never the entities. Payments depends on orders (one-way).
 */
export { PaymentsModule } from './payments.module';
export { PaymentService } from './services/payment.service';
