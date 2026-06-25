# Phase 6 — Payments (gateways + reconciliation)

> Gateway-agnostic payments: a swappable `PAYMENT_GATEWAY` port, COD + a MOCK
> online adapter, idempotent webhooks, a reconciliation job that recovers
> dropped callbacks (edge #2), and staff-issued refunds. On success it confirms
> the order's reservation and deducts stock via `OrderService`.
> **Depends on:** Phase 5 (orders). **Date:** 2026-06-26. Schema: `DATABASE_SCHEMA.md` §8.

---

## 1. Scope

- **`PAYMENT_GATEWAY` port** + `PaymentGatewayRegistry` (enum → adapter). Only an
  adapter ever imports a vendor SDK. Ships **COD** + **MOCK** (a self-contained
  online gateway exercising initiate→redirect→webhook→reconcile). bKash / Nagad /
  Rocket / SSLCommerz / ShurjoPay drop into the same port later (D33).
- **Initiate** (`POST /payments/initiate`): online → create `payment`, call
  `adapter.initiate`, return a redirect URL; **COD** → confirm the order (deduct
  stock, PENDING→CONFIRMED) immediately, payment stays pending collection (D34).
- **Webhook** (`POST /payments/webhook/:gateway`, public): verify signature,
  **dedupe by `gateway_txn_id`** (unique), settle on SUCCESS / mark FAILED.
- **Reconciliation** (periodic sweep): for stuck INITIATED/PENDING online
  payments, poll `adapter.fetchStatus` and settle — recovers a dropped callback
  (edge #2).
- **Refund** (`POST /payments/refund`, staff): create `refund`, call the gateway,
  set payment REFUNDED, reconcile the order's `payment_status` via `OrderService`
  (D36 — one-way payments→orders dependency, no circular import).
- **COD capture** (`POST /payments/:id/capture`, staff): mark COD collected on
  delivery → order `payment_status` PAID.

---

## 2. Decisions (continue the D-series)

| # | Decision | Choice |
| --- | --- | --- |
| **D33** | Gateways shipped | **COD + MOCK** online adapter behind `PAYMENT_GATEWAY`. Real BD gateways drop in later (need creds/network). |
| **D34** | COD stock/payment timing | **Confirm at placement** (deduct stock, PENDING→CONFIRMED, paymentStatus UNPAID); **collect on delivery** (paymentStatus→PAID). Online still deducts on PAID (Phase 5 D29). |
| **D35** | `order.paid` side effect | Best-effort `NotificationProvider` stub call on success (no consumer until Phase 10; a transactional payments outbox can be added then). |
| **D36** | Refund coupling | **Staff-initiated via Payments; payments→orders one-way.** Returns/cancels set the accounting intent on the order; the actual gateway refund is `POST /payments/refund`, which reconciles `payment_status` through `OrderService.applyRefund`. |
| **D37** | Idempotency | `payment.idempotency_key` unique (per initiate) + an open/successful-payment guard per order (no double-pay); `payment_transaction.gateway_txn_id` unique (webhook dedupe). |
| **D38** | Webhook auth | `@Public` route; **HMAC-SHA256 signature** verified by the adapter (MOCK uses `PAYMENTS_MOCK_SECRET`). Real adapters verify their own scheme. |
| **D39** | Roles | Staff for refund/capture/admin reads = **ADMIN + CUSTOMER_SUPPORT** (`PAYMENTS_STAFF_ROLES`). Initiate/own-status = the authenticated buyer. |

---

## 3. Schema (`payments` schema; enums stored as **varchar** per codebase convention)

`payment` (Auditable; order_id/user_id logical, gateway, amount, status, **idempotency_key unique**, gateway_reference) · `payment_transaction` (Base, APPEND-ONLY; type, status, amount, **gateway_txn_id unique-where-not-null**, raw_payload jsonb) · `refund` (SoftDeletable; payment_id, order_id, amount, status, gateway_refund_id). In-schema FKs only. Migration `1782519600000-CreatePaymentsTables`.

```
PaymentGateway: BKASH NAGAD ROCKET SSLCOMMERZ SHURJOPAY COD   (MOCK added for dev/test)
PaymentState:   INITIATED → PENDING → SUCCESS | FAILED | CANCELLED ; SUCCESS → REFUNDED
PaymentTxnType: CHARGE | CALLBACK | WEBHOOK | REFUND
```

---

## 4. Gateway port

```ts
PAYMENT_GATEWAY (token) → PaymentGatewayRegistry.for(gateway): PaymentGatewayAdapter
interface PaymentGatewayAdapter {
  gateway: PaymentGateway;
  initiate(input): { gatewayReference; redirectUrl?; status }     // online charge
  verifyCallback(payload): { gatewayTxnId; status; amount?; raw } // throws on bad signature
  fetchStatus(gatewayReference): { gatewayTxnId; status; ... }     // reconciliation poll
  refund(input): { gatewayRefundId; status }
}
```

## 5. Orders seams added (payments → orders, one-way)

- `getPayableOrder(orderId, userId)` → `{ id,userId,grandTotal,currency,status,paymentStatus }`; 404 if not theirs, 409 if not PENDING/already paid.
- `markPaid(orderId, actorId)` (existing) — online success: confirm reservations (SOLD) + PENDING→PAID + paymentStatus PAID.
- `confirmOrder(orderId, actorId)` — COD: confirm reservations (SOLD) + PENDING→CONFIRMED, paymentStatus UNPAID.
- `recordPaymentCaptured(orderId, actorId)` — COD collection: paymentStatus→PAID (no status change).
- `applyRefund(orderId, amount, actorId)` — paymentStatus REFUNDED (full) / PARTIALLY_REFUNDED (partial); idempotent.
- **Fix:** `applyCancellationStock` now keys off order **status** (PENDING ⇒ release held; committed ⇒ return sold stock) instead of `paymentStatus === PAID`, so COD's confirmed-but-unpaid stock is returned correctly on cancel.

## 6. Endpoints (`/api/v1/payments`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/payments/initiate` | buyer | Start a charge (online → redirectUrl; COD → confirm order) |
| POST | `/payments/webhook/:gateway` | public | Gateway callback/webhook (signature-verified, idempotent) |
| GET | `/payments/order/:orderId` | owner/staff | Payment(s) + status for an order |
| POST | `/payments/refund` | staff | Refund an order's payment (gateway + reconcile order) |
| POST | `/payments/:id/capture` | staff | Mark a COD payment collected (on delivery) |

## 7. Edge cases

| # | Edge case | Handling |
| --- | --- | --- |
| 2 | Payment ok but callback dropped | Reconciliation sweep polls `fetchStatus` → settles the order |
| — | Duplicate webhook | Unique `gateway_txn_id` → second delivery is a no-op |
| — | Double-pay | Open/successful payment guard per order + unique `idempotency_key` |

## 8. Build order
entities+migration → orders seams → gateway port + COD/MOCK adapters + registry →
repos → dtos → PaymentService + reconciliation sweeper → controller → module/app
wiring + config → unit specs (gateway signature, state) + app-context smoke.

**DoD:** COD end-to-end (placement confirms + deducts stock, capture marks paid);
MOCK online end-to-end (initiate→webhook success→order PAID); duplicate webhook is
a no-op; reconciliation recovers a dropped callback; staff refund reconciles order
payment_status; build + lint + tests green.
</content>
