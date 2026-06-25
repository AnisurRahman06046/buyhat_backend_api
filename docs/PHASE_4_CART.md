# Phase 4 — Cart (design)

> Guest + customer carts, merge-on-login, price snapshots, and abandoned-cart
> detection. Read with `PROJECT_PLAN.md §Phase 4` and `DATABASE_SCHEMA.md §6`.
> Builds on completed Phases 0–3.
>
> **Date:** 2026-06-25 · **Status:** **implemented & verified.** Decisions D19–D24
> resolved (see §12). Build + lint + 27 unit tests green; migration applied; live
> smoke passed — guest add → merge-on-login (sum, no item loss) → totals, with
> price snapshot + availability annotation.

---

## 1. Scope

**In scope**
- **Guest cart** keyed by a `guest_id` (no login) and **customer cart** keyed by
  `user_id`; one ACTIVE cart per identity (partial-unique).
- Line operations: add / update qty / remove / clear; **one line per variant**.
- **Price + name snapshot** per line, captured from catalog at add time and
  re-validated on read (D21).
- **Availability annotation** from inventory on read (D22).
- **Merge on login** (`POST /cart/merge`): fold the guest cart into the user's
  ACTIVE cart (edge #7).
- **Abandoned-cart** detection: inactivity sweeper → mark ABANDONED + notify (D23).

**Out of scope (later phases)**
- Reserving stock → **Phase 5** (order/checkout calls `InventoryService.reserve`).
  The cart is **not** a stock hold.
- Coupon/discount math → **Phase 7** (the `coupon_code` column is stored but not
  applied; totals are pre-discount).
- Converting a cart to an order → **Phase 5** (sets cart `CONVERTED`).

---

## 2. Data model (cart schema)

Per `DATABASE_SCHEMA.md §6`; enums stored as **varchar** (build convention).

| Entity | Role |
| --- | --- |
| `cart` (`SoftDeletableEntity`) | `user_id?`, `guest_id?`, `status`, `currency`, `coupon_code?`, `last_activity_at`; partial-unique one-ACTIVE-per-user and one-ACTIVE-per-guest |
| `cart_item` (`BaseEntity`) | `cart_id` (FK CASCADE), `variant_id`, `product_id`, `quantity`, `unit_price_snapshot`, `product_name_snapshot`; unique `(cart_id, variant_id)` |

```ts
enum CartStatus { ACTIVE, MERGED, CONVERTED, ABANDONED }
```

Indexes: `uq_cart_active_user` unique(`user_id`) WHERE status='ACTIVE' AND user_id IS NOT NULL;
`uq_cart_active_guest` unique(`guest_id`) WHERE status='ACTIVE' AND guest_id IS NOT NULL;
`(status, last_activity_at)` for the abandoned sweeper; `(cart_id, variant_id)` unique.

Migration: `CreateCartTables` (cart → cart_item).

---

## 3. Identity & sessions

Cart endpoints accept **either** an authenticated user **or** a guest:
- `OptionalJwtAuthGuard` (a non-throwing `AuthGuard('jwt')`): a valid token →
  `req.user`; no/invalid token → anonymous (no 401). Controller is `@Public()`
  (bypass the global guard) + `@UseGuards(OptionalJwtAuthGuard)`.
- **Guest id (D19 — resolved default):** server-generated `uuid`. If a write
  arrives with no user and no `X-Guest-Id`, the service mints one and returns it
  in the response body + an `X-Guest-Id` response header; the client echoes it on
  later requests. Logged-in requests ignore any guest id.
- `CartResolver.resolveActiveCart({ userId, guestId }, { create })` returns (or
  lazily creates) the caller's ACTIVE cart; `last_activity_at` is bumped on every
  mutation (drives the abandoned sweeper).

---

## 4. Cart operations

All within the cart's currency; line total = `unit_price_snapshot × quantity`;
cart subtotal = Σ line totals (pre-discount).

- **Add item** (`POST /cart/items { variantId, quantity }`): call catalog
  `getVariantSaleInfo(variantId)` (§3 cross-module). Reject if missing/not
  sellable (variant inactive or product not ACTIVE) → 422. Snapshot
  `unit_price` + `product_name` + `product_id`. If the line exists, **increment**
  quantity (clamped to `MAX_QTY_PER_LINE`, default 99). Stock handling per D22.
- **Update qty** (`PUT /cart/items/:itemId { quantity }`): set (≥1; 0 ⇒ use delete).
- **Remove** (`DELETE /cart/items/:itemId`) / **Clear** (`DELETE /cart`).
- **Get** (`GET /cart`): returns lines with refreshed snapshots (D21) + per-line
  `available` and `inStock` from inventory (D22), and a computed subtotal.

> Cross-module (service layer only): catalog `getVariantSaleInfo` (new method,
> returns `{ variantId, productId, productName, unitPrice, currency, sellable }`),
> inventory `getBulkAvailability(variantIds)`. Cart never touches their entities.

---

## 5. Merge on login (edge #7)

`POST /cart/merge { guestId }` (authenticated): fold the guest's ACTIVE cart into
the user's ACTIVE cart (created if absent), in one transaction:
1. Load guest ACTIVE cart (by `guestId`) and user ACTIVE cart.
2. For each guest line: if the user cart has that variant → **combine per D20**;
   else move the line over (re-snapshot price).
3. Mark the guest cart `MERGED`; bump the user cart activity.
4. Return the merged user cart.
Idempotent-ish: a guest cart already MERGED/empty is a no-op.

---

## 6. Price snapshot & revalidation (D21)

Snapshots are captured at add time. On `GET /cart`, each line is re-validated
against catalog `getVariantSaleInfo`; resolution per **D21**. Lines whose variant
is no longer sellable are flagged (`sellable=false`) so the UI/checkout can prompt
removal (checkout in Phase 5 will block on them).

---

## 7. Abandoned cart (D23)

A periodic **sweeper** (mirrors the inventory reservation sweeper): every N
minutes, find `cart` rows with `status='ACTIVE' AND last_activity_at < now() −
CART_ABANDONED_AFTER_MIN` (default **1440** = 24h), mark them `ABANDONED`, and emit
a notification (`cart.abandoned` → notification port; real email/SMS in Phase 10).
A per-cart delayed job is rejected because activity continually resets the timer —
a sweep over `last_activity_at` models "inactivity" cleanly.

---

## 8. API design

> `@Public()` + `OptionalJwtAuthGuard` on the whole controller; identity = user
> (token) or `X-Guest-Id`. No admin endpoints.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/cart` | current cart (refreshed snapshots + availability + subtotal) |
| POST | `/cart/items` | add a line `{ variantId, quantity }` |
| PUT | `/cart/items/:itemId` | set line quantity |
| DELETE | `/cart/items/:itemId` | remove a line |
| DELETE | `/cart` | clear all lines |
| POST | `/cart/merge` | 🔒 merge `{ guestId }` into the user cart |

`POST /cart/items` (and merge) may return `X-Guest-Id` for new guests.

---

## 9. Edge-case scenarios

| # | Scenario | Handling |
| --- | --- | --- |
| K1 | **Guest logs in with items** (#7) | `/cart/merge` folds guest→user (D20); guest cart → MERGED |
| K2 | **Two ACTIVE carts per identity** | partial-unique indexes forbid it; resolver reuses the one ACTIVE cart |
| K3 | **Add same variant twice** | unique `(cart_id, variant_id)` → increment the existing line |
| K4 | **Price changed since add** | revalidate on read (D21) |
| K5 | **Variant unpublished/deleted after add** | `getVariantSaleInfo` → not sellable → line flagged; checkout (Phase 5) blocks |
| K6 | **Out-of-stock at add/read** | per D22 |
| K7 | **Abandoned cart** | sweeper marks ABANDONED + notifies (D23) |
| K8 | **Concurrent add to same cart** | unique line index + upsert-on-conflict increment in a tx |
| K9 | **Quantity ≤ 0 or huge** | DTO `@IsInt @Min(1)`; clamp to `MAX_QTY_PER_LINE` |
| K10 | **Merge when user has no cart** | create the user cart, then move lines |

---

## 10. Build order

1. Entities + `CreateCartTables` migration.
2. Repositories (cart, cart_item) on `BaseRepository` (+ active-cart finders, upsert).
3. `OptionalJwtAuthGuard` (common) + guest-id resolution helper.
4. Catalog: add `getVariantSaleInfo(variantId)` to the service layer (cart consumes it).
5. `CartService` — resolve/create cart; add/update/remove/clear; snapshots +
   availability annotation; subtotal.
6. `CartMergeService` (or method) — merge algorithm (D20) in a transaction.
7. Abandoned sweeper + `cart.abandoned` notification.
8. Controller + DTOs + response envelope; `X-Guest-Id` handling.
9. Tests: unit (merge combine logic, subtotal, snapshot refresh, qty clamp) +
   app-context smoke (guest add → merge on login → totals; abandoned sweep).

---

## 11. Definition of Done

- A guest builds a cart (no login) and, on login, `/cart/merge` folds it into the
  user cart with **no item loss** (D20 applied to overlaps).
- Prices snapshot at add and re-validate on read (D21); unsellable lines flagged.
- One ACTIVE cart per identity enforced; same-variant adds increment one line.
- Abandoned sweeper marks stale carts ABANDONED and emits a notification.
- Migration applies cleanly; unit + smoke tests green.

---

## 12. Decisions (resolved 2026-06-25)

| # | Decision | Resolution |
| --- | --- | --- |
| D19 | Guest id transport | Server-minted `uuid`, returned via body + `X-Guest-Id` header; client echoes it. |
| D20 | Merge overlap | **Sum** guest + user quantities for the same variant (clamped to `MAX_QTY_PER_LINE`). |
| D21 | Price changed on read | **Refresh** the line snapshot to current price + per-line `priceChanged` flag. |
| D22 | Stock at add/read | **Allow** adding any sellable variant; **annotate** `available`/`inStock` on read (true hold = checkout). |
| D23 | Abandoned detection | **Periodic sweeper** over `last_activity_at`; threshold `CART_ABANDONED_AFTER_MIN` (default 1440 = 24h). |
| D24 | `MAX_QTY_PER_LINE` | **99**. |
