# BuyHat Backend — Phased Build Plan

> A dependency-ordered roadmap to take the current NestJS production-starter
> scaffold to a complete, production-grade e-commerce backend.
>
> **Sources analysed:** `BuyHat Webiste.docx` (product/domain spec),
> `Buyhat_backend/BuyHat Backend.docx` (module architecture spec),
> `README.md` + `CODE_REVIEW.md` + the actual `src/` scaffold.
> **Date:** 2026-06-24

---

## 0. Where we are today (ground truth on disk)

The repo currently holds a **generic, reusable NestJS modular-monolith
boilerplate** — not yet BuyHat-specific business logic. What is already built
and compiling (`npm run build` passes):

**Cross-cutting infrastructure — DONE**
- NestJS 11 + TypeScript, modular-monolith layout (`controller → service → repository → entity`).
- Typed config + fail-fast env validation (`src/config/`).
- PostgreSQL + TypeORM, `synchronize: false`, migration CLI wired (`src/database/`).
- Redis (ioredis) wrapper + BullMQ queue scaffolding (`src/shared/`).
- JWT access/refresh auth + Passport `jwt` strategy; global `JwtAuthGuard`
  (secure-by-default) + `@Public()`; `RolesGuard` + `@Roles()` RBAC.
- Uniform response/error envelope (interceptor + exception filters).
- pino structured logging, Swagger at `/docs`, `@nestjs/throttler`, Terminus health.
- Multi-stage non-root Dockerfile + docker-compose (Postgres + Redis).

**Reference feature modules — DONE (generic, to be adapted)**
- `auth` — register / login / refresh, JWT strategy.
- `users` — full CRUD (controller → service → repository → DTO) as the pattern to copy.
- `health` — liveness / readiness probes.

**Persistence base — DONE**
- `common/entities/BaseEntity` — UUID PK + `created_at` / `updated_at` + soft-delete `deleted_at`.

**Not yet started:** every BuyHat domain module (catalog, cart, orders,
inventory, payments, promotions, cms, reviews, notifications, reporting), all
domain entities/migrations beyond the base, and the production blockers listed
in `CODE_REVIEW.md`.

> **Note on prior design notes:** earlier design work (a per-module Postgres
> schema layout, `AuditableEntity`/`BaseRepository`/`BaseService`, an `src/infra/`
> tree, a Phase-1 DB design doc) was *designed but never committed to this working
> copy*. Those are good targets and are folded into **Phase 0 / Phase 1** below,
> but treat this document — anchored to what is actually on disk — as the source
> of truth.

---

## 1. Target architecture & conventions (recap)

1. **Modular monolith, microservice-ready.** One deployable; each module is
   isolated like a service.
2. **No cross-module DB access.** A module never imports another module's entity
   or repository — only its public service via the module barrel (`modules/<name>/index.ts`).
3. **Clean layering:** `controller (thin) → service (business logic) → repository (DB) → entity`.
4. **Cross-aggregate references are plain UUID columns** (e.g. `userId`,
   `productId`), never cross-module foreign keys. FKs only *within* a module's
   own tables. This is the seam that keeps later extraction cheap.
5. **Eventual consistency across modules** via a transactional **outbox →
   BullMQ** relay for side effects (e.g. "user.registered" → create profile;
   "order.paid" → deduct stock + notify).
6. **Migrations only** (`synchronize` stays off); UUIDs from `gen_random_uuid()`
   / app-side UUIDv7; soft-delete + audit columns on master tables.

**Decision to confirm (D1):** physical module isolation strategy —
(a) keep the current single `public` schema with UUID logical refs (simplest), or
(b) **one Postgres schema per module** (`auth`, `catalog`, …) for a hard
boundary and `pg_dump -n <schema>` extraction. Prior design favoured (b). The
plan assumes **(b)** and schedules the switch in Phase 0; it is reversible to (a)
cheaply. See [Open decisions](#9-open-decisions--risks).

---

## 2. Module ownership map

| Module | Owns (tables, abridged) | Key spec features |
| --- | --- | --- |
| **auth** | account/identity, roles, refresh tokens, one-time tokens (verify/reset/OTP), outbox | register/login/refresh/logout, RBAC (5 roles), email verify, password reset, OTP |
| **users** | profile, address | `/users/me`, addresses CRUD, preferences, default shipping/billing |
| **catalog** | category, brand, attribute, category_attribute, product, product_attribute_value, variant, media | dynamic attributes, category tree, variants (SKU/price/stock/barcode/weight), slugs, media |
| **inventory** | stock, stock_movement (ledger), reservation, low_stock_alert | available/reserved/sold/damaged/returned, 15-min checkout hold, deduct/release |
| **cart** | cart, cart_item | guest cart (`guest_id`), customer cart, merge on login, price snapshot, abandoned detection |
| **orders** | order, order_item, order_status_history, return, refund | checkout, lifecycle state machine, cancel, returns/refunds |
| **payments** | payment, payment_transaction, refund_txn, reconciliation | gateway adapters (bKash/Nagad/Rocket/SSLCommerz/ShurjoPay/COD), initiate/callback/webhook/refund |
| **promotions** | coupon, coupon_redemption, flash_sale, flash_sale_item, campaign | percentage/fixed/free-ship coupons, usage/user limits, flash sales (auto-activate), campaigns |
| **cms** | homepage_section, banner, hero_slide, popup, landing_page, announcement | homepage builder, banners, hero slider, popups (rules+audience), landing pages |
| **reviews** | review, rating | ratings, reviews, verified-purchase, moderation/approve |
| **notifications** | notification, template, delivery_log | email/SMS/push, templates, queued delivery |
| **reporting** | (reads via services/materialized views) | sales/inventory/product/customer reports |
| **audit** (cross-cutting) | audit_log | login, product/stock/order changes |

> **Boundary note (banners/popups):** the website spec lists banners/popups
> under *Promotions*; the backend spec lists them under *CMS*. This plan puts
> **visual content (banners, hero slider, popups, announcement bar, landing
> pages, homepage layout) in CMS**, and **discount logic (coupons, flash sales,
> campaigns) in Promotions**. Confirm (D2).

---

## 3. Phase plan (dependency-ordered)

Each phase is shippable and testable on its own. Critical path:
**Phase 0 → Auth/Users → Catalog → Inventory → Cart → Orders → Payments**, with
Promotions / CMS / Reviews / Notifications / Reporting layering on top.

### Phase 0 — Foundation hardening & production blockers
**Goal:** make the existing scaffold production-safe and BuyHat-ready before any
domain work. Mostly closing `CODE_REVIEW.md` items + adding shared primitives.

- **Fix the 10 review blockers:**
  1. `VERSION_NEUTRAL` on `HealthController` (restore `/health/*` for probes).
  2. First migration: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` (or move to `gen_random_uuid()`/pgcrypto).
  3. Lock CORS — explicit origins in non-dev; never `*` + credentials.
  4. Per-route `@Throttle` on `/auth/login|register|refresh` (e.g. 5/60s).
  5. Collapse to a single exception filter (keep validation `details`); map PG `23505 → 409`.
  6. Redis-backed throttler storage (multi-replica).
  7. Partial unique index on `email WHERE deleted_at IS NULL`.
  8. Enforce `@MinLength(32)` on JWT secrets.
  9. Refresh-token `jti` in Redis with rotation + reuse-detection + revocation.
  10. Exclude Terminus health from response wrapping + throttling; add request correlation id to pino.
- **Shared primitives:** `AuditableEntity` (soft-delete + `createdBy`/`updatedBy` +
  optimistic `version`), `BaseRepository<T>`, `BaseService<T>`; `SCHEMA` constants
  + schema-bootstrap migration (if D1 = per-schema).
- **Object storage:** S3/MinIO provider behind a `STORAGE_PROVIDER` token (needed by catalog/cms media).
- **Outbox plumbing:** `outbox_event` table + BullMQ relay worker (used from Phase 1 on).
- **Seeds:** first ADMIN from env; idempotent seed runner.
- **CI:** lint + build + test + migration check.

**Definition of Done:** all 10 blockers fixed; build + e2e green; health probes
reachable at `/health/*`; storage + outbox relay smoke-tested; seed creates admin.

---

### Phase 1 — Identity: Auth, Users, Roles, Addresses
**Depends on:** Phase 0. **Spec:** Auth + Users modules, Security requirements.

- **auth:** adapt reference module → `register`, `login`, `refresh` (rotating),
  `logout` (revoke), `forgot-password`, `reset-password`, optional OTP login.
  Argon2 (or bcrypt) hashing; `one_time_token` table (unified
  EMAIL_VERIFICATION | PASSWORD_RESET | OTP via `purpose` enum); email-verify flow.
- **RBAC:** 5 roles — `CUSTOMER` (default), `ADMIN`, `INVENTORY_MANAGER`,
  `CUSTOMER_SUPPORT`, `MARKETING_MANAGER`; roles carried in JWT (`roles[]`),
  enforced by `RolesGuard`.
- **users:** `GET/PUT /users/me`, addresses CRUD (`/users/address*`),
  preferences (locale, currency default BDT, marketing opt-in). Profile created
  idempotently from the `user.registered` outbox event (eventual consistency).
- **Notifications stub:** thin email/SMS port so verify/reset/OTP can send now;
  full module lands in Phase 10.
- **audit:** log login + auth events (audit interceptor introduced here).

**DoD:** full auth lifecycle works incl. refresh rotation + revocation; me/address
endpoints; admin seeded; roles enforced; verify/reset emails sent via stub;
unit + e2e tests.

---

### Phase 2 — Catalog (the core, dynamic product model)
**Depends on:** Phase 1, Phase 0 storage. **Spec:** Catalog, Dynamic Product
Architecture, Variant System.

- **Dynamic attributes (no per-type tables):** `category`, `attribute`,
  `category_attribute` (which attributes apply to a category), `product`,
  `product_attribute_value`. Admin creates categories/attributes from the panel —
  no deployment.
- **Variants:** `variant` with SKU, price, stock pointer, barcode, weight
  (e.g. Red+Small). Variant-level identity (inventory tracked per variant).
- **Brands, media** (images via storage), product **slugs**, category **tree**
  (nested set / `parentId` + path).
- **Endpoints:** public `GET /products`, `GET /products/:slug`, `GET /categories`,
  `GET /brands`, `GET /attributes`; admin write CRUD for all + `POST /products/:id/variants`.
- **Edge cases:** #4 (deleting a category with products → **prevent / archive**),
  #5 (variant stock mismatch → variant-level only).

**DoD:** create a multi-category catalog with distinct attribute sets and
variants entirely via API; public read endpoints paginated/filterable;
category-delete guard verified.

---

### Phase 3 — Inventory (stock + reservation ledger)
**Depends on:** Phase 2. **Spec:** Inventory Design, Stock Reservation, edge
cases 1/3/9.

- **Stock ledger:** `stock` per variant + immutable `stock_movement` ledger
  (IN / OUT / RESERVE / RELEASE / ADJUST / RETURN / DAMAGE). Buckets:
  available / reserved / sold / damaged / returned; `available = on_hand - reserved`.
- **Reservation:** `reservation` with TTL (default 15 min) created at checkout;
  **BullMQ delayed job** releases on expiry; released on payment failure.
- **Low-stock alerts** (threshold → outbox/notification).
- **Endpoints:** `GET /inventory/:variantId`, `POST /inventory/stock-in|stock-out|adjustment|reserve|release`.
- **Edge cases:** #1 (revalidate stock before payment), #3 (multi-tab → reservation
  is the guard), #9 (refund/return → ledger movement, never silent mutation).

**DoD:** concurrent reservations cannot oversell (tested under contention);
expiry job releases held stock; every quantity change has a ledger row.

---

### Phase 4 — Cart (guest + customer + merge)
**Depends on:** Phase 2 (prices), Phase 3 (availability). **Spec:** Guest Cart,
Cart Merge, Abandoned Cart.

- **Guest cart** keyed by `guest_id` (cookie/localStorage), no login required:
  add / update / remove. **Customer cart** for logged-in users.
- **Merge on login** (`POST /cart/merge`): union guest + existing cart (edge #7).
- **Price snapshot** per line; re-validate against catalog on read.
- **Abandoned cart:** inactivity > 24h → BullMQ job → notification (email/SMS/push)
  + optional coupon offer.
- **Endpoints:** `GET /cart`, `POST /cart/items`, `PUT/DELETE /cart/items/:id`, `POST /cart/merge`.

**DoD:** guest can build a cart and have it merged on login with no item loss;
abandoned-cart job fires; prices snapshot correctly.

---

### Phase 5 — Orders & Checkout (business engine)
**Depends on:** Phases 3 + 4. **Spec:** Checkout Flow, Order Lifecycle, Returns,
edge cases 1/8/9.

- **Checkout flow:** browse → cart → checkout → shipping address → login/register →
  payment → order (login *not* forced first).
- **Order creation from cart** with inventory **reservation**; **revalidate stock
  before payment** (#1); **lock price at checkout** so flash-sale end mid-checkout
  doesn't change totals (#8).
- **Lifecycle state machine:** `PENDING → CONFIRMED → PAID → PROCESSING → PACKED →
  SHIPPED → DELIVERED`; alt paths `→ CANCELLED`, and
  `DELIVERED → RETURN_REQUESTED → RETURNED → REFUNDED`. `order_status_history` audit.
- **Returns/refunds** scaffolding (settlement via Payments in Phase 6); refunds
  post stock movements (#9).
- **Endpoints:** `POST /orders`, `GET /orders`, `GET /orders/:id`,
  `POST /orders/:id/cancel|return`, `PATCH /orders/:id/status` (staff).

**DoD:** end-to-end order from cart with stock reserved/deducted on the right
transitions; illegal transitions rejected; price locked at checkout; cancel
releases stock.

---

### Phase 6 — Payments (gateways + reconciliation)
**Depends on:** Phase 5. **Spec:** Payment Requirements, edge case 2.

- **Gateway abstraction:** `PAYMENT_GATEWAY` port + adapters — **bKash, Nagad,
  Rocket, SSLCommerz, ShurjoPay, COD** (Stripe/PayPal later). Only the adapter
  imports the vendor SDK.
- **Flows:** `POST /payments/initiate`, `POST /payments/callback` + webhook,
  `GET /payments/status/:orderId`, `POST /payments/refund`. **Idempotent**
  webhooks (dedupe by gateway txn id).
- **Reconciliation job (edge #2):** scheduled worker reconciles "payment
  succeeded but callback failed" by polling gateway status; transitions order to
  PAID and triggers fulfilment.
- On success → confirm reservation → deduct stock (sold) → emit `order.paid` →
  notifications. On failure → release reservation.

**DoD:** at least one real gateway (e.g. SSLCommerz sandbox) + COD end-to-end;
duplicate webhook is a no-op; reconciliation recovers a dropped callback in test.

---

### Phase 7 — Promotions (coupons, flash sales, campaigns)
**Depends on:** Phases 2 + 5. **Spec:** Coupon Engine, Flash Sale, edge cases 6/8.

- **Coupons:** percentage / fixed / free-shipping; rules: min purchase, specific
  categories, **usage limits + per-user limits + IP monitoring** (anti-abuse, #6).
  `POST /coupons/validate` used at checkout.
- **Flash sales:** admin sets products/discount/start/end; **scheduler
  auto-activates/deactivates**; price locked at checkout (#8).
- **Campaigns.** Applied during Order total calculation (Phase 5 integrates the
  discount service).
- **Endpoints:** `GET/POST /coupons`, `POST /coupons/validate`, `GET/POST /flash-sales`, campaigns.

**DoD:** coupon validation enforces all limits and rejects abuse; flash sale
activates/expires on schedule; discounts reflected in order totals.

---

### Phase 8 — CMS (homepage builder & content)
**Depends on:** Phase 0 storage, Phase 2 (links to products/categories). **Spec:**
CMS, Promotion Management (banners/popups/hero).

- **Homepage builder:** ordered, configurable sections (hero slider, flash sale,
  categories, featured products, brands, banner, best sellers, newsletter) — no
  code deploy to re-order.
- **Banners** (image + CTA + schedule), **hero slider** (multi-slide + reorder),
  **popups** (rules: show once / every session / after 5s / exit intent;
  audience: guests / logged / everyone), **announcement bar**, **landing pages**.
- **Endpoints:** `GET/PUT /cms/homepage`, `GET/POST /cms/banners`, `/cms/popups`,
  hero/landing.

**DoD:** admin composes & reorders a homepage and schedules a banner/popup purely
via API; public `GET /cms/homepage` returns the rendered layout.

---

### Phase 9 — Reviews
**Depends on:** Phases 2 + 5. **Spec:** Reviews.

- Ratings + reviews on products; **verified-purchase** flag (checks orders via
  service); **moderation** (`PATCH /reviews/:id/approve`); aggregate rating on product.
- **Endpoints:** `GET /products/:id/reviews`, `POST /products/:id/reviews`,
  `PATCH /reviews/:id/approve`.

**DoD:** only purchasers can mark verified; unapproved reviews hidden from public;
product rating aggregates correctly.

---

### Phase 10 — Notifications (full multi-channel)
**Depends on:** Phase 1 stub. **Spec:** Notification Requirements.

- **Channels:** email (order confirmed/shipped/delivered), SMS (OTP, order
  updates), push (promotions, abandoned cart). Provider adapters behind ports;
  **BullMQ** queues with retries/backoff; **templates**; `delivery_log`.
- Replaces the Phase 1 stub; consumes outbox events emitted by auth/cart/orders/payments.
- **Endpoints:** `POST /notifications/email|sms|push`, `GET /notifications/templates`.

**DoD:** order lifecycle + OTP + abandoned-cart events deliver via real providers
(sandbox); failures retry and are logged.

---

### Phase 11 — Reporting & Audit
**Depends on:** data from prior phases. **Spec:** Reporting, Audit Logging.

- **Reports:** sales (daily/weekly/monthly/yearly), inventory (low/out of stock),
  products (best/worst sellers), customers (new/repeat). Read-only, composed via
  services / materialized views (no cross-module table reads).
- **Audit log:** finalize cross-cutting audit (login, product/stock/order
  changes) started in Phase 1 → queryable `audit_log`.
- **Endpoints:** `GET /reports/sales|products|users|inventory`, admin audit views.

**DoD:** each report matches a hand-computed fixture; sensitive mutations produce
audit rows.

---

### Phase 12 — Search, performance & launch hardening
**Depends on:** all. **Spec:** Search (Phase 2 in spec = Elasticsearch/OpenSearch),
Security, Reports.

- **Search:** Elasticsearch/OpenSearch index for products (facets on dynamic
  attributes); sync via outbox.
- **Performance:** caching strategy (Redis) for hot reads (homepage, product
  detail, categories); keyset pagination for deep lists; DB indexes review;
  connection-pool tuning.
- **Observability & ops:** metrics/tracing, alerting, load test of checkout path,
  full security review, backups, runbooks, deployment hardening.

**DoD:** product search with attribute facets; documented p95 latency under load
test; security review actioned; deploy runbook complete.

---

## 4. Edge-case traceability matrix

| # | Edge case (spec) | Solution | Phase |
| --- | --- | --- | --- |
| 1 | Stock zero during checkout | Revalidate inventory before payment | 3, 5 |
| 2 | Payment ok but callback fails | Reconciliation job | 6 |
| 3 | Checkout in multiple tabs | Inventory reservation | 3 |
| 4 | Admin deletes category with products | Prevent deletion / archive | 2 |
| 5 | Variant stock mismatch | Variant-level inventory only | 2, 3 |
| 6 | Coupon abuse | Usage + user limits, IP monitoring | 7 |
| 7 | Guest cart + user logs in | Cart merge strategy | 4 |
| 8 | Flash sale ends during checkout | Lock price at checkout | 5, 7 |
| 9 | Refund after inventory adjusted | Separate stock-movement ledger | 3, 5 |

---

## 5. Cross-cutting sequencing

- **Notifications:** thin stub in **Phase 1** (verify/reset/OTP) → full module in
  **Phase 10**. Earlier phases emit outbox events; the channel that consumes them
  upgrades transparently.
- **Audit:** interceptor + `audit_log` introduced in **Phase 1**, finalized in **Phase 11**.
- **Storage (S3/MinIO):** in **Phase 0**, consumed by catalog (2) and cms (8).
- **Outbox + BullMQ relay:** **Phase 0**, used by every module that triggers a
  cross-module side effect.
- **Discount service:** built in **Phase 7** but **Phase 5** must define the
  order-total calculation seam it plugs into.

---

## 6. Roles & permissions (from spec)

| Role | Capabilities |
| --- | --- |
| Customer | register, login, browse, cart, place orders, review |
| Admin | full system access |
| Inventory Manager | manage stock + warehouse operations |
| Customer Support | view orders, process returns, handle complaints |
| Marketing Manager | manage promotions, campaigns, homepage content |

---

## 7. Order & inventory state machines

**Order:** `PENDING → CONFIRMED → PAID → PROCESSING → PACKED → SHIPPED →
DELIVERED`; `* → CANCELLED` (pre-shipment); `DELIVERED → RETURN_REQUESTED →
RETURNED → REFUNDED`. Each transition writes `order_status_history` and may emit
an outbox event.

**Inventory buckets:** `available = on_hand − reserved`; movements:
`IN, OUT, RESERVE, RELEASE, ADJUST, RETURN, DAMAGE`. Reservation lifecycle:
`HELD → (CONFIRMED→SOLD | RELEASED | EXPIRED)`.

---

## 8. Suggested milestones

1. **M1 — Secure foundation:** Phase 0 + Phase 1 (auth/users/roles).
2. **M2 — Browsable catalog:** Phase 2 + Phase 3 (catalog + inventory).
3. **M3 — Buyable store (MVP):** Phase 4 + 5 + 6 (cart → order → payment). *First end-to-end purchase.*
4. **M4 — Merchandising:** Phase 7 + 8 + 9 (promotions, cms, reviews).
5. **M5 — Operable at scale:** Phase 10 + 11 + 12 (notifications, reporting, search/hardening).

---

## 9. Open decisions / risks

- **D1 — Schema isolation:** one Postgres schema per module (assumed) vs single
  `public` schema with UUID logical refs. Affects every entity + a bootstrap
  migration. Decide before Phase 0 closes.
- **D2 — Banners/popups ownership:** CMS (assumed) vs Promotions. Affects module
  boundaries in Phases 7–8.
- **D3 — Password hashing:** Argon2 (spec) vs bcrypt (currently in scaffold).
  Recommend Argon2id; swap during Phase 1.
- **D4 — Payment gateway priority:** which BD gateway(s) to integrate first for
  M3 (sandbox availability dictates order). COD is free and should ship in M3.
- **D5 — Notifications providers:** pick concrete email/SMS/push vendors before Phase 10.
- **Risk — concurrency:** oversell and double-spend of stock/coupons are the
  highest-risk areas; lean on DB constraints + reservations + idempotency keys,
  and test under contention (Phases 3, 6, 7).

---

## 10. Per-phase status tracker (keep updated)

| Phase | Title | Status |
| --- | --- | --- |
| 0 | Foundation hardening | ◼ done — 10 CODE_REVIEW blockers fixed; schema-per-module (D1=isolated) + base-class split + BaseRepository/BaseService + schema-bootstrap migration + admin seed + CI. *(S3/MinIO storage pulled into Phase 2, outbox relay into Phase 1 — built where first consumed.)* |
| 1 | Auth / Users / Roles | ◼ done — auth/users split, Argon2id, roles[] JWT, register→verify→login→refresh(rotation+reuse)→logout, forgot/reset, outbox→profile, addresses + admin status/roles, **audit logging**. Migrations applied; **12 unit tests + 14-check live smoke test all green** (incl. outbox→profile, reuse-detection, RBAC). Also fixed env-validation int coercion (`@Type(() => Number)`). |
| 2 | Catalog | ◧ core done (everything except media) — categories(tree)/brands/attributes(+options)/products/variants; dynamic **attribute inheritance** (category+ancestors) + **auto variant generation** (cartesian + `attribute_signature` idempotency) + publishing (DRAFT/ACTIVE/ARCHIVED). Migration applied; build+lint green; **12-check app-context integration test passed**. Remaining: **media** (local-disk↔S3 storage port), run unit tests, attr-facet filtering (→ Phase 12 search). |
| 3 | Inventory | ◻ not started |
| 4 | Cart | ◻ not started |
| 5 | Orders & Checkout | ◼ done — checkout from cart with price lock (#8) + atomic all-or-nothing reservation (#1), order lifecycle state machine + append-only history, cancel (release/return stock), staff status PATCH + `markPaid` seam (Payments=Phase 6), **full returns** with RETURN ledger movements (#9) + refund status. Login-required (D26), inline+saved address (D27), full returns (D28). Migration applied; build+lint+**36 unit tests** green; **18-check live end-to-end smoke passed** (reserve→pay→cancel→return ledger verified). Design: `docs/PHASE_5_ORDERS.md`. |
| 6 | Payments | ◼ done — gateway-agnostic `PAYMENT_GATEWAY` port + registry (COD + MOCK online; real BD gateways drop in later), idempotent signed webhooks (dedupe by gateway_txn_id), reconciliation sweep recovering dropped callbacks (#2), staff refunds reconciling order payment_status, double-pay guard. COD confirms+deducts at placement & collects on delivery (D34); online deducts on PAID via `OrderService.markPaid`. Migration applied; build+lint+**42 unit tests** green; **18-check live e2e smoke passed** (COD, online webhook, duplicate no-op, bad-sig reject, reconcile, refund). Design: `docs/PHASE_6_PAYMENTS.md`. |
| 7 | Promotions | ◻ not started |
| 8 | CMS | ◻ not started |
| 9 | Reviews | ◻ not started |
| 10 | Notifications | ◻ not started |
| 11 | Reporting & Audit | ◻ not started |
| 12 | Search & hardening | ◻ not started |

> Legend: ◻ not started · ◧ in progress · ◼ done
