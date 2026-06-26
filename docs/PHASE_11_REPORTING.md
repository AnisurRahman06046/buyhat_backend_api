# Phase 11 — Reporting & Audit

> Read-only business reporting (sales, products, customers, inventory) plus a
> queryable audit log. Reporting keeps its own **denormalized fact tables** in
> the `reporting` schema, fed by **one-way service seams** the owning modules
> call at the moment of a business event — never by reading another module's
> tables. Audit (started in Phase 1) gains an admin read endpoint.
> **Depends on:** orders, inventory, auth. **Date:** 2026-06-26. Schema: `reporting`.

---

## 1. Scope

- **Reports (ADMIN):** sales over time (day/week/month/year), product best/worst
  sellers, customers (total/new/repeat), inventory low/out of stock.
- **Denormalized read model:** `order_fact`, `product_sales`, `customer_fact`
  in the `reporting` schema, maintained incrementally + idempotently by seams.
- **Audit finalize:** `GET /audit` (ADMIN) over the existing `audit.audit_log`.
- **CMS auto best-sellers:** CMS `BEST_SELLERS` sections hydrate from live
  reporting data instead of manual `config.productIds`.

---

## 2. Decisions (continue the D-series)

| # | Decision | Choice |
| --- | --- | --- |
| **D66** | Data strategy | **Denormalized fact tables fed by one-way seams.** Owning modules call `ReportingService.record*()` at commit time (domain events = service calls, like payments→orders `applyRefund`). Reporting never reads other schemas. Pure current-state lookups (inventory low/out) **forward** to the owning service (`InventoryService.getStockReport`) rather than mirror high-churn stock. |
| **D67** | Best-sellers → CMS | **Auto-wired.** CMS `BEST_SELLERS` calls `ReportingService.getBestSellers(limit)` → product ids, then hydrates via its existing catalog seam. Falls back to `config.productIds` when reporting has no data. `FEATURED_PRODUCTS` stays manual. |
| **D68** | Roles | **ADMIN only** for all `/reports/*` and `/audit` (`REPORTS_VIEW_ROLES = [ADMIN]`). |
| **D69** | Idempotency / counting | `order_fact` keyed unique by `order_id`. The first time an order commits, the row is inserted **and** `product_sales` / `customer_fact` are incremented (atomic `INSERT … ON CONFLICT … DO UPDATE`). Later status changes only update the fact's status fields — units are never double-counted. |
| **D70** | Sale date | Revenue is attributed to **`committed_at`** (set when the order first commits: PAID online / CONFIRMED COD), so it is always present and matches recognition. |
| **D71** | Refunds | A committed order that is later refunded/cancelled sets `order_fact.refunded_amount` + `is_refunded`; `net_revenue = Σ grand − Σ refunded`. Product units sold are **not** reversed (best-sellers = gross units). |

---

## 3. Schema (`reporting` schema; enums/money as in the codebase)

- `order_fact` — `order_id` **unique**, `user_id?`, `status`, `payment_status`,
  `currency`, `subtotal`, `discount_amount`, `grand_amount`, `refunded_amount`
  (default 0), `is_refunded`, `items_count`, `placed_at?`, `committed_at`.
  Index `(committed_at)`.
- `product_sales` — `product_id` **unique**, `qty_sold`, `order_count`,
  `revenue`, `last_sold_at`. Index `(qty_sold)`.
- `customer_fact` — `user_id` **unique**, `registered_at`, `first_order_at?`,
  `orders_count` (default 0), `total_spent` (default 0), `last_order_at?`.

Migration `1782520100000-CreateReportingTables`. All fact tables are
append/upsert read-models (extend `BaseEntity`, no soft delete).

## 4. Flow & cross-module seams (all one-way → reporting)

```
orders.runTransition(PAID) / orders.confirmOrder(COD)
   → ReportingService.recordOrderCommitted({orderId,userId,totals,lines})
orders.applyRefund / cancel-after-commit
   → ReportingService.recordOrderRefunded(orderId, refundedAmount)
auth.register (post-commit)
   → ReportingService.recordCustomerRegistered(userId)
cms.getHomepage [BEST_SELLERS]
   → ReportingService.getBestSellers(limit) → ids → catalog hydration
reports controller [inventory]
   → InventoryService.getStockReport()   (forward; reporting imports inventory)
```

- `ReportingModule` imports **InventoryModule** only; **exports
  ReportingService**. `OrdersModule`, `AuthModule`, `CmsModule` import
  `ReportingModule`. No cycles (reporting imports none of them).
- All record seams are **best-effort** (`void`, never throw into the business
  txn), consistent with notifications/audit.

## 5. Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/reports/sales?from&to&granularity` | ADMIN | Revenue/orders/items per period |
| GET | `/reports/products?limit&order` | ADMIN | Best (`desc`) / worst (`asc`) sellers |
| GET | `/reports/customers?from&to` | ADMIN | Total / new / repeat customers |
| GET | `/reports/inventory?limit` | ADMIN | Low / out-of-stock (forwarded) |
| GET | `/audit?action&actorId&targetType&from&to` | ADMIN | Audit log (paginated) |

`granularity ∈ {day, week, month, year}` (whitelisted → `date_trunc`).

## 6. Edge cases

| Edge case | Handling |
| --- | --- |
| Order committed twice (retry) | `order_fact` unique + first-insert gate → counted once (D69) |
| Refund after sale | `refunded_amount`/`is_refunded`; net excludes it (D71) |
| Guest/no-user order | `order_fact.user_id` null; customer_fact untouched |
| Same product on 2 lines | lines aggregated by product before incrementing (one `order_count`) |
| Archived product in best-sellers | reporting returns ids; CMS catalog hydration skips inactive (D52) |
| Reporting seam fails | best-effort `void` + logged; never breaks order/registration |

## 7. Build order
schema const → entities + migration → repositories → DTOs → ReportingService
(record seams + report queries) → controller + module → wire orders/auth/inventory/
cms seams + app registration → audit query (service + repo + controller) → unit
specs + e2e boot smoke + migration run.

**DoD:** each report matches a hand-computed fixture; committing an order updates
sales/product/customer facts exactly once; refunds reflected in net revenue;
audit rows queryable; build + lint + tests + e2e green.
