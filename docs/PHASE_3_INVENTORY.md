# Phase 3 — Inventory (design)

> Stock ledger, variant-level availability, and the reservation system that makes
> overselling impossible under concurrency. Read with `PROJECT_PLAN.md §Phase 3`
> and `DATABASE_SCHEMA.md §5`. Builds on completed Phases 0–2.
>
> **Date:** 2026-06-25 · **Status:** **implemented & verified.** Decisions D13–D18
> resolved (see §11). Build + lint + 24 unit tests green; migrations applied;
> live smokes passed — 5-way reserve contention (no oversell), lifecycle
> (release/confirm/expire), and the catalog→inventory `variant.created` pipeline.

---

## 1. Scope

**In scope**
- **Stock items** — one per variant (`available = on_hand − reserved`), reorder level.
- **Movement ledger** — immutable, append-only `stock_movement` (every quantity
  change writes one row; edge case #9).
- **Reservations** — `stock_reservation` with a TTL hold; atomic reserve that
  cannot oversell; release/confirm; **expiry releases held stock**.
- **Stock operations** — stock-in, stock-out, adjustment, return, damage (admin).
- **Provisioning** — consume catalog's `variant.created` → create a `stock_item`
  (qty 0). Requires **promoting the outbox to a shared abstraction** (§5).
- **Low-stock alerts** — when `available ≤ reorder_level`, emit an event/notification.
- Read endpoints (availability) + admin stock-ops endpoints + internal
  reserve/release (called by cart/orders in later phases via the service layer).

**Out of scope (later phases)**
- Cart/checkout that *calls* reserve → **Phase 4**; order paid → confirm/deduct →
  **Phase 5/6**. Phase 3 ships the inventory engine + admin/manual + internal API;
  `cart_id`/`order_id` on a reservation are nullable logical refs until then.
- Multi-warehouse / multi-location stock (single logical location for now).
- Purchase orders / supplier management.

---

## 2. Data model (inventory schema)

Entities per `DATABASE_SCHEMA.md §5`; Phase 3 refinements below. Enums stored as
**varchar** (matching the build's convention, not native PG enums).

| Entity | Role |
| --- | --- |
| `stock_item` (`AuditableEntity`) | per-variant `quantity_on_hand`, `quantity_reserved`, `reorder_level`; **`version`** for optimistic safety; unique `variant_id` |
| `stock_movement` (`BaseEntity`, append-only) | signed `quantity`, `type`, `balance_after`, `reference_type/id`, `reason`, `created_by` |
| `stock_reservation` (`BaseEntity`) | `variant_id`, `quantity`, `status`, `cart_id?`, `order_id?`, `expires_at` |

```ts
enum StockMovementType { IN, OUT, RESERVE, RELEASE, ADJUST, SALE, RETURN, DAMAGE }
enum ReservationStatus { HELD, CONFIRMED, RELEASED, EXPIRED }
```

**Refinements over §5**
1. `available` is **not stored** — computed as `on_hand − reserved` (D15).
2. Indexes: `uq_stock_variant` unique(`variant_id`); `stock_movement(variant_id, created_at)`
   + `(reference_type, reference_id)`; `stock_reservation(status, expires_at)` (expiry
   sweeper) + `(cart_id)` + `(order_id)`.
3. `stock_movement` is **never updated or deleted** — corrections are new rows
   (RETURN/ADJUST), preserving an auditable history (edge case #9).

Migration: `CreateInventoryTables` (stock_item → stock_movement → stock_reservation).

---

## 3. Concurrency & reservations (the heart)

The invariant: **`quantity_reserved ≤ quantity_on_hand` always**, even under
simultaneous reservations of the last unit. Two correctness tools:

### 3.1 Atomic reserve (D14 — proposed: conditional UPDATE)
Reserve runs a single guarded statement so the check-and-increment is atomic:
```sql
UPDATE inventory.stock_item
   SET quantity_reserved = quantity_reserved + :qty, version = version + 1
 WHERE variant_id = :variantId
   AND quantity_on_hand - quantity_reserved >= :qty
RETURNING *;
```
0 rows affected ⇒ insufficient stock ⇒ **409** (no reservation row created). On
success, in the **same transaction**: insert the `stock_reservation` (HELD,
`expires_at = now + TTL`) and a `RESERVE` movement. This needs no app-level lock
and is immune to lost updates. (Alternatives in §11: `SELECT … FOR UPDATE`,
optimistic-`version`-retry.)

### 3.2 Reservation lifecycle
`HELD → CONFIRMED` (order paid: reserved→sold, `quantity_on_hand -= qty`, SALE
movement) · `HELD → RELEASED` (manual/payment-failure: `quantity_reserved -= qty`,
RELEASE movement) · `HELD → EXPIRED` (TTL elapsed: same effect as RELEASE, status
EXPIRED). Each transition is one transaction: mutate `stock_item` + write the
ledger row + flip reservation status. Confirm/release are **idempotent** on
reservation status (only HELD transitions), so redelivery/double-calls are safe.

### 3.3 Stock operations (admin)
`stock-in` (+on_hand, IN), `stock-out` (−on_hand, OUT — guarded `on_hand−reserved ≥ qty`),
`adjustment` (set/delta, ADJUST), `return` (+on_hand, RETURN), `damage`
(−on_hand, DAMAGE). All compute `balance_after` and append a movement in the txn.

---

## 4. Availability & low-stock

- `GET /inventory/:variantId` → `{ onHand, reserved, available, reorderLevel, lowStock }`.
- Bulk `GET /inventory?variantIds=…` for cart/PLP needs (capped).
- After any mutation, if `available ≤ reorder_level` → call the
  `NOTIFICATION_PROVIDER` port directly (D13 note). De-duped so it fires on
  threshold crossing (available went from `> reorder_level` to `≤`), not every decrement.

---

## 5. Event integration & the outbox promotion (D13)

Catalog must emit **`variant.created`** (deferred from Phase 2) and inventory must
consume it. Today the outbox is **auth-only** (`OutboxRelayService` hardcodes
`FROM auth.outbox_event`); the entity itself flags "promote to a shared
abstraction when a second module starts emitting events." Phase 3 is that trigger.

**D13 resolved: duplicate the outbox per module** (auth untouched).
- **Catalog** gets its own `catalog.outbox_event` + `OutboxService` +
  `CatalogOutboxRelayService` (copies of auth's, scanning `catalog.outbox_event`).
  `VariantService.generate` records `variant.created` per new variant **inside its
  existing transaction**.
- The catalog relay publishes to a **dedicated `catalog-events` queue** — not the
  `domain-events` queue. Reason: BullMQ delivers each job to exactly one worker, so
  putting a second `@Processor` on `domain-events` (alongside users') would split
  events arbitrarily. A separate queue keeps a clean single-consumer stream.
- **Inventory consumer** (`@Processor('catalog-events')`) handles `variant.created`
  → `InventoryService.provisionStockItem(variantId)` (idempotent: no-op if a
  `stock_item` already exists for the variant).

> Low-stock (§4) is **not** event-sourced in Phase 3: inventory calls the
> `NOTIFICATION_PROVIDER` port directly (a best-effort alert, not cross-module
> state coordination), avoiding a third outbox. Promote to an event later if needed.

---

## 6. Reservation expiry (D16 — proposed: delayed job + sweeper)

- On reserve, enqueue a **BullMQ delayed job** (`inventory` queue,
  `delay = TTL`, `jobId = reservationId`) → on fire, release if still HELD.
- A **periodic sweeper** (interval, `status=HELD AND expires_at < now()`,
  `FOR UPDATE SKIP LOCKED`) is the backstop for jobs lost to a Redis flush —
  so expiry is guaranteed even if the delayed job vanished.
- TTL default **15 min**, env-configurable (`INVENTORY_RESERVATION_TTL_MIN`).

---

## 7. API design

> Phase 0 envelope. Public read; 🔒 admin/internal. Stock writes =
> `@Roles(ADMIN, INVENTORY_MANAGER)` (D17 — both roles already exist).

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/inventory/:variantId` | public | availability for one variant |
| GET | `/inventory?variantIds=a,b` | public | bulk availability (capped) |
| GET | `/inventory/:variantId/movements` | admin | ledger history (paginated) |
| POST | `/inventory/stock-in` | admin | `{ variantId, quantity, reason? }` |
| POST | `/inventory/stock-out` | admin | guarded against reserved |
| POST | `/inventory/adjustment` | admin | set/delta + reason (required) |
| POST | `/inventory/return` | admin | +on_hand (RETURN) |
| POST | `/inventory/damage` | admin | −on_hand (DAMAGE) |
| POST | `/inventory/reserve` | admin/internal | `{ variantId, quantity, ttl?, cartId? }` → reservation |
| POST | `/inventory/release` | admin/internal | `{ reservationId }` |
| POST | `/inventory/confirm` | admin/internal | `{ reservationId }` → SALE |

> `reserve/release/confirm` are guarded for now; in Phase 4/5 cart & order
> services call `InventoryService` **directly** (service layer, no HTTP).

---

## 8. Edge-case scenarios

| # | Scenario | Handling |
| --- | --- | --- |
| I1 | **Oversell on the last unit** (#1/#3) | atomic conditional UPDATE (§3.1) → 409 if `available < qty` |
| I2 | **Multi-tab checkout** (#3) | each tab holds its own reservation; availability already nets reserved |
| I3 | **Refund/return after adjustment** (#9) | RETURN/ADJUST **ledger rows**, never silent mutation |
| I4 | **Reservation expiry** | delayed job + sweeper release HELD past `expires_at` |
| I5 | **Variant has no stock_item yet** | `variant.created` provisions qty 0; availability of a missing item = 0 |
| I6 | **Double confirm / double release** | idempotent on `status` (only HELD transitions) |
| I7 | **Stock-out below reserved** | guarded `on_hand − reserved ≥ qty` → 409 |
| I8 | **Negative/zero quantities** | DTO validation `@IsInt @Min(1)` |
| I9 | **Concurrent stock-ops** | `version` optimistic lock on `stock_item` + atomic SQL |
| I10 | **Event redelivery** (`variant.created`) | provisioning is idempotent (unique `variant_id`) |
| I11 | **Low-stock spam** | fire on threshold crossing only |

---

## 9. Build order

1. Catalog outbox (copy auth's pattern): `catalog.outbox_event` entity + `OutboxService`
   + relay → `catalog-events` queue. `CreateCatalogOutbox` migration. No auth changes.
2. Inventory entities + `CreateInventoryTables` migration.
3. Repositories (stock_item, stock_movement, stock_reservation) on `BaseRepository`.
4. `InventoryService` — provision; stock-ops (ledger-writing); **atomic reserve**;
   release/confirm; availability; low-stock emit.
5. Catalog: `VariantService.generate` records `variant.created` (in-txn).
6. `variant.created` consumer → `provisionStockItem` (idempotent).
7. Reservation expiry: BullMQ delayed job (`inventory` queue) + sweeper backstop.
8. Controllers + DTOs + response envelopes; roles.
9. Tests: unit (atomic reserve under contention, ledger balance math, lifecycle
   idempotency, low-stock crossing) + app-context smoke (provision → reserve →
   oversell-blocked → release → expiry).

---

## 10. Definition of Done

- Generating a variant provisions a `stock_item` (qty 0) via `variant.created`.
- Concurrent reservations **cannot oversell** (proven under contention in a test).
- Every quantity change has exactly one `stock_movement` row; `balance_after` ties out.
- Expiry releases HELD stock (delayed job + sweeper); confirm/release idempotent.
- Availability endpoints correct; low-stock event fires on threshold crossing.
- Migration applies cleanly; unit + smoke tests green; auth events still work
  after the outbox refactor.

---

## 11. Decisions (resolved 2026-06-25)

| # | Decision | Resolution |
| --- | --- | --- |
| D13 | Outbox for multiple producers | **Duplicate per module** — catalog gets its own `catalog.outbox_event` + relay → `catalog-events` queue; auth untouched. Low-stock via direct notification port. |
| D14 | Reserve concurrency | **Atomic conditional UPDATE** (`SET reserved += qty WHERE on_hand − reserved ≥ qty`); 0 rows → 409. |
| D15 | `available` | **Computed in app** (`on_hand − reserved`). |
| D16 | Expiry mechanism | **BullMQ delayed job per reservation + periodic sweeper backstop.** |
| D17 | Stock write roles | **`ADMIN + INVENTORY_MANAGER`** (`INVENTORY_WRITE_ROLES`). |
| D18 | Reservation TTL | **15 min**, env `INVENTORY_RESERVATION_TTL_MIN`. |
