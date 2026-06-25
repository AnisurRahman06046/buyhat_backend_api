/**
 * Public API of the `orders` module. The Payments module (Phase 6) confirms
 * payment via `OrderService.markPaid` — never by touching orders' tables.
 */
export { OrdersModule } from './orders.module';
export { OrderService } from './services/order.service';
