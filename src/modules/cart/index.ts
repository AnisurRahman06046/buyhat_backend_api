/**
 * Public API of the `cart` module. Orders (Phase 5) read/convert the cart via
 * `CartService` — never the entities.
 */
export { CartModule } from './cart.module';
export { CartService } from './services/cart.service';
export type { CartIdentity } from './services/cart.service';
