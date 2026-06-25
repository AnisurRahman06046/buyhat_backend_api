# Phase 5 — Orders & Checkout

> The business engine: convert a cart into an immutable order, hold stock with
> inventory reservations, lock prices at checkout, drive the order lifecycle
> state machine, and handle cancellations and returns.
> **Depends on:** Phase 3 (inventory reservations) + Phase 4 (cart).
> **Date:** 2026-06-25. Schema source: `docs/DATABASE_SCHEMA.md` §7.

---

## 1. Scope

- **Checkout** (`POST /orders`): build an order from the authenticated user's
  ACTIVE cart — revalidate sellability + **lock price at checkout** (edge #8),
  **revalidate stock and reserve it atomically** (edge #1), snapshot the
  shipping/billing addresses, compute totals, persist the order `PENDING`, and
  mark the cart `CONVERTED`.
- **Order lifecycle** state machine with an append-only `order_status_history`.
- **Cancellation**: releases held stock (pre-payment) or returns sold stock +
  flags a refund (post-payment, pre-shipment).
- **Returns / refunds (full)**: request → approve/reject → receive. Receiving a
  return posts `RETURN` stock movements back into inventory (edge #9) and moves
  the order/payment status toward `REFUNDED`. Monetary gateway settlement is
  Phase 6; Phase 5 records the refund **intent** (paymentStatus + history).

---

## 2. Decisions (continue the project D-series)

| # | Decision | Choice |
| --- | --- | --- |
| **D25** | Checkout reservation atomicity | **All-or-nothing** via a new `InventoryService.reserveMany(...)` (one inventory transaction; any short line aborts the whole reservation). Orders never touches inventory tables — service seam only. |
| **D26** | Guest checkout | **Require login.** `POST /orders` is `JwtAuthGuard`-protected; `order.user_id` always set. `guest_email` column reserved but unused this phase. |
| **D27** | Address at checkout | **Both** a saved `addressId` (orders calls `UsersService.getAddressSnapshot` and snapshots it) **or** inline address fields. Billing defaults to shipping. Stored as an immutable `order_address` snapshot (never an FK to `users.address`). |
| **D28** | Returns/refunds scope | **Full** returns now, incl. `RETURN` stock movements back into inventory. Money settlement deferred to Phase 6 (we set `payment_status` REFUNDED/PARTIALLY_REFUNDED + history). |
| **D29** | When stock is deducted (reservation → SOLD) | On **PAID**. Stock is *reserved* (HELD, ~15-min TTL) at checkout and *confirmed* (SOLD, on-hand drops) when the order reaches `PAID`. Cancel before PAID releases the hold; cancel after PAID returns the stock. |
| **D30** | Payment seam (Payments = Phase 6) | `OrderService.markPaid(orderId, actorId)` confirms reservations + sets PAID. For Phase 5 it is reachable via the staff `PATCH /orders/:id/status` → `PAID`. Phase 6's gateway callback will call `markPaid` directly. |
| **D31** | Roles | Customer: place / view-own / cancel-own (pre-payment) / request-return. Staff = **ADMIN + CUSTOMER_SUPPORT** (`ORDERS_STAFF_ROLES`): list all, drive fulfilment transitions, process returns. |
| **D32** | Order number | Human-readable `BH-YYYYMMDD-XXXXXX` (6 base36 chars), unique index + retry on collision. |

Totals this phase: `discount_total`/`shipping_total`/`tax_total` = 0 (seams kept;
coupons land in Phase 7). `grand_total = subtotal − discount + shipping + tax`.

---

## 3. Schema (`orders` schema; enums stored as **varchar** per codebase convention)

`order` (Auditable) · `order_item` (Base) · `order_address` (Base, snapshot) ·
`order_status_history` (Base, append-only) · `order_return` (SoftDeletable) ·
`order_return_item` (Base). In-schema FKs only (`order_id`/`return_id`/`order_item_id`
CASCADE/RESTRICT); `user_id`/`variant_id`/`product_id` are logical UUID refs.
Migration `1782519500000-CreateOrdersTables`.

```
OrderStatus:   PENDING → CONFIRMED → PAID → PROCESSING → PACKED → SHIPPED → DELIVERED
               (PENDING..PACKED) → CANCELLED
               DELIVERED → RETURN_REQUESTED → RETURNED → REFUNDED   (RETURN_REQUESTED → DELIVERED = reject)
PaymentStatus: UNPAID → PAID → (PARTIALLY_REFUNDED | REFUNDED)
ReturnStatus:  REQUESTED → APPROVED → RECEIVED → REFUNDED ; REQUESTED → REJECTED
```

Stock side-effects by transition:
- **create** → `reserveMany` (HELD, orderId ref).
- **→ PAID** → `confirmReservationsForOrder` (HELD→CONFIRMED, SALE movement, on-hand drops).
- **→ CANCELLED** while pre-PAID → `releaseReservationsForOrder` (RELEASE movement).
- **→ CANCELLED** while PAID+ → `returnToStock` per item (RETURN movement) + paymentStatus REFUNDED.
- **return RECEIVED** → `returnToStock` per returned item (RETURN movement) + order RETURNED, then REFUNDED.

---

## 4. Cross-module additions (service-layer seams only)

- **catalog** `VariantSaleInfo` gains `sku` (used for `order_item.sku_snapshot`).
- **inventory** `InventoryService`: `reserveMany`, `confirmReservationsForOrder`,
  `releaseReservationsForOrder`, `returnToStock` (RETURN movement w/ ORDER ref);
  `StockReservationRepository.findByOrder`.
- **users** `UsersService.getAddressSnapshot(userId, addressId)` → address fields (404 if not theirs).
- **cart** `CartService`: `getActiveCart(userId)` (entity-backed) + `markConverted(cartId)`.
- **audit** new `ORDER_*` action codes (created / status_changed / cancelled / return_requested / returned).

---

## 5. Endpoints (`/api/v1/orders`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/orders` | customer | Checkout: create order from active cart |
| GET | `/orders` | customer (own) / staff (all via `?all=true`) | List orders (paginated, `?status=`) |
| GET | `/orders/:id` | owner or staff | Order detail |
| POST | `/orders/:id/cancel` | owner (pre-payment) / staff (pre-shipment) | Cancel + stock release/return |
| PATCH | `/orders/:id/status` | staff | Drive fulfilment transitions (incl. PAID) |
| POST | `/orders/:id/returns` | owner (DELIVERED) | Request a return for specific items |
| GET | `/orders/:id/returns` | owner or staff | List returns for an order |
| PATCH | `/orders/returns/:returnId` | staff | approve / reject / receive a return |

---

## 6. Edge cases covered

| # | Edge case | Handling |
| --- | --- | --- |
| 1 | Stock zero during checkout | Pre-check availability + **atomic `reserveMany`**; 409 if short, no order created |
| 3 | Multi-tab checkout | Reservation is the guard; the last unit reserves exactly once |
| 8 | Flash sale ends mid-checkout | `unit_price` **locked** into `order_item` at checkout from fresh catalog price |
| 9 | Refund after inventory adjusted | Returns post `RETURN` movements; never a silent stock mutation |

---

## 7. Build order

1. orders enums + entities + migration.
2. Cross-module seams (catalog/inventory/users/cart/audit).
3. repositories → DTOs → `orders.constants.ts` (state machine + roles).
4. `OrderService` (checkout/list/get/cancel/status/markPaid) + `OrderReturnService`.
5. controllers → module → wire `app.module`.
6. unit specs (state machine, totals, order-number) + app-context smoke.

**DoD:** end-to-end order from cart with stock reserved at checkout and deducted
on PAID; illegal transitions rejected; price locked at checkout; cancel releases/
returns stock; returns post ledger movements; build + lint + tests green.
</content>
</invoke>
