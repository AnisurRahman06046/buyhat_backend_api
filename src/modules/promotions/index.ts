/**
 * Public API of the `promotions` module. Cart and orders apply discounts via
 * `PromotionsService` (quote / redeem / active flash prices) — never the tables.
 */
export { PromotionsModule } from './promotions.module';
export { PromotionsService } from './services/promotions.service';
export type {
  QuoteCouponInput,
  QuoteLine,
  RedeemInput,
} from './services/promotions.service';
