# Phase 7 — Promotions (coupons, flash sales, campaigns)

> A coupon engine with abuse controls (edge #6), scheduled flash sales whose
> price is locked at checkout (edge #8), and a campaign container. Plugs the
> discount seam Phase 5 left open (`order.discount_total = 0`).
> **Depends on:** Phase 2 (catalog) + Phase 5 (orders). **Date:** 2026-06-26.
> Schema: `DATABASE_SCHEMA.md` §9.

---

## 1. Scope

- **Coupons**: PERCENTAGE / FIXED / FREE_SHIPPING; rules = min purchase, max
  discount cap (%), global usage limit, per-user limit, validity window, and
  **category restriction** (applies only to eligible lines). `POST /coupons/validate`
  previews a discount; abuse controls (usage/user/IP) = edge #6.
- **Flash sales**: admin sets variants + sale price + window; a sweeper
  auto-activates/ends them; the sale price is applied in the **cart view** and
  **locked into the order at checkout** (edge #8).
- **Campaigns** (`promotion`): a lightweight container coupons can belong to.
- **Checkout integration**: `OrderService` overlays flash prices and applies the
  cart's coupon → `discount_total` / `grand_total`. Coupon **redemption is
  recorded at payment success** (D40), enforcing limits authoritatively.

---

## 2. Decisions (continue the D-series)

| # | Decision | Choice |
| --- | --- | --- |
| **D40** | Coupon redemption timing | **At payment success** (`OrderService.markPaid` for online, `confirmOrder` for COD). Checkout validates limits as a pre-check; the `coupon_redemption` row + `used_count` increment happen when the order commits. Unique `(coupon_id, order_id)` → idempotent. In-flight unpaid carts don't consume a use. |
| **D41** | Category-restricted coupons | **Included.** `PromotionsService` resolves each line's product→category via `CatalogService` (new `getProductCategories` seam, promotions→catalog one-way) and discounts only eligible lines. |
| **D42** | Flash-sale price visibility | **Checkout + cart display.** Cart reads annotate the effective (flash) price; checkout locks it into `order_item.unit_price`. Catalog browse-time display deferred to Phase 12. |
| **D43** | Flash-sale activation | A `FlashSaleSweeper` (interval, like the cart/reservation sweepers) flips SCHEDULED→ACTIVE→ENDED. Pricing queries by **timestamp window** (not just status) so it's correct even between sweeps. |
| **D44** | Abuse monitoring (#6) | `coupon_redemption` logs `user_id` + `ip_address`; validation enforces global `usage_limit`, `usage_limit_per_user`, and a per-IP cap counted from redemptions. |
| **D45** | Write roles | Promotions admin = **ADMIN + MARKETING_MANAGER** (`PROMOTIONS_WRITE_ROLES`); `validate` = authenticated buyer; active flash sales = public. |

> FREE_SHIPPING coupons validate/redeem but have no monetary effect yet
> (shipping_total = 0 until shipping is modeled); recorded for completeness.

---

## 3. Schema (`promotions` schema; enums as **varchar** per convention)

`promotion` (campaign container) · `coupon` (unique code) · `coupon_category`
(restriction) · `coupon_redemption` (APPEND-ONLY, unique `(coupon_id, order_id)`,
`ip_address`) · `flash_sale` · `flash_sale_item` (unique `(flash_sale_id, variant_id)`,
`sale_price`, `quantity_limit`/`sold_count`). Migration `1782519700000-CreatePromotionsTables`.

```
CouponType:      PERCENTAGE | FIXED | FREE_SHIPPING
FlashSaleStatus: SCHEDULED → ACTIVE → ENDED
```

## 4. Cross-module seams

- **catalog** `ProductService.getProductCategories(productIds)` → Map<productId, categoryId> (for coupon category eligibility).
- **promotions** `PromotionsService` (the facade orders/cart call):
  - `getActiveFlashPrices(variantIds)` → Map<variantId, salePrice> (cart + checkout).
  - `quoteCoupon({ code, userId, lines, subtotal })` → `{ couponId, code, discountAmount, freeShipping }` or throws (checkout + `/coupons/validate`).
  - `redeemForOrder({ orderId, userId, code, discountAmount, ip, flashLines })` → records redemption + increments counters (idempotent; called at payment success).
- **orders** `checkout` overlays flash prices + applies coupon discount; `markPaid`/`confirmOrder` call `redeemForOrder`. OrdersModule → PromotionsModule.
- **cart** `buildResponse` overlays flash prices; new `applyCoupon`/`clearCoupon` + `POST /cart/coupon`. CartModule → PromotionsModule.

## 5. Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST/GET/PATCH/DELETE | `/coupons*` | staff | Coupon CRUD (+ category links) |
| POST | `/coupons/validate` | buyer | Preview a coupon discount for the active cart |
| GET/POST/PATCH/DELETE | `/flash-sales*` | staff | Flash-sale CRUD (+ items) |
| GET | `/flash-sales/active` | public | Currently-active flash sales |
| GET/POST/PATCH/DELETE | `/promotions*` (campaigns) | staff | Campaign CRUD |
| POST/DELETE | `/cart/coupon` | buyer/guest | Apply / clear a coupon on the cart |

## 6. Edge cases

| # | Edge case | Handling |
| --- | --- | --- |
| 6 | Coupon abuse | global + per-user + per-IP limits enforced at validate; redemptions logged with IP |
| 8 | Flash sale ends mid-checkout | price locked into `order_item.unit_price` at checkout from the window-active flash price |

## 7. Build order
catalog seam → promotions enums/entities/migration → repos → DTOs → services
(Coupon/FlashSale/Promotion admin + PromotionsService facade) + FlashSaleSweeper →
controllers → orders + cart integration → module/app wiring → unit specs
(discount math, coupon validation) + app-context smoke.

**DoD:** coupon validation enforces all limits + rejects abuse; flash sale
activates/ends on schedule and its price locks at checkout; discounts reflected in
order totals; redemptions recorded at payment; build + lint + tests green.
</content>
