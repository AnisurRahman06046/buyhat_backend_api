# Phase 9 — Reviews (ratings, verified purchase, moderation)

> Product ratings + reviews with **verified-purchase** detection (via orders),
> **moderation** (PENDING→APPROVED/REJECTED), one review per user per product,
> and an aggregate rating denormalized onto `catalog.product`.
> **Depends on:** Phase 2 (catalog) + Phase 5 (orders). **Date:** 2026-06-26.
> Schema: `DATABASE_SCHEMA.md` §11.

---

## 1. Scope

- **Reviews**: a `review` (rating 1–5, optional title/body, optional variant) per
  product. Any authenticated user may post; a **verified-purchase** flag +
  `order_id` are auto-set when the user has actually bought the product (D53).
- **Moderation**: new reviews are `PENDING`; only `APPROVED` reviews show
  publicly. Staff `approve`/`reject` (D55).
- **Aggregate rating**: `product.rating_avg` / `rating_count` are recomputed over
  the product's APPROVED reviews and pushed to catalog on any change to that set
  (D54).
- **Ownership**: a user edits/deletes their own review (edit → re-moderation);
  staff can delete any (D57). `helpful_count` increment (D58).

---

## 2. Decisions (continue the D-series)

| # | Decision | Choice |
| --- | --- | --- |
| **D53** | Who can review + verified flag | **Any authenticated user** may review (not gated on purchase). `is_verified_purchase` + `order_id` are auto-detected via a one-way **reviews→orders** seam (`OrderService.findPurchasedOrderId(userId, productId)` → most recent order containing the product with status **not in {PENDING, CANCELLED}**). |
| **D54** | Rating aggregate mechanism | **Direct synchronous catalog seam.** On any change to a product's APPROVED set (approve / reject / owner-edit-away-from-approved / delete), reviews recomputes `AVG(rating)` + `COUNT` over its **own** APPROVED rows and calls `ProductService.applyRatingAggregate(productId, avg, count)`. Immediate consistency; consistent with existing synchronous cross-module writes (orders→inventory). *(DB doc suggested an outbox event; deferred — switch to outbox only if async/extraction needs it. Catalog never reads reviews tables either way.)* |
| **D55** | Moderation | Reviews default `PENDING`; public reads return `APPROVED` only. Staff `PATCH /reviews/:id/approve` \| `/reject`. Moderators = **ADMIN + CUSTOMER_SUPPORT** (`REVIEWS_MODERATE_ROLES`). |
| **D56** | One per user per product | Partial-unique `(user_id, product_id) WHERE deleted_at IS NULL`; a second review → **409**. |
| **D57** | Edit / delete | Owner edits their review (rating/title/body) → resets to `PENDING` (re-moderation; aggregate recomputed if it had been approved). Owner or staff soft-deletes (aggregate recomputed if it was approved). |
| **D58** | Helpful votes | `POST /reviews/:id/helpful` increments `helpful_count` (authenticated, no per-user dedupe yet — abuse-hardening deferred to Phase 12). |

---

## 3. Schema (`reviews` schema; enum as **varchar** per convention)

`review` (SoftDeletable): `product_id`, `variant_id?`, `user_id`, `order_id?`
(verified link), `rating` smallint **CHECK 1..5**, `title?`, `body?`,
`is_verified_purchase`, `status` varchar, `helpful_count`. Partial-unique
`(user_id, product_id) WHERE deleted_at IS NULL`; index `(product_id, status)`
for public listing. Migration `1782519900000-CreateReviewsTables`.

```
ReviewStatus: PENDING → APPROVED | REJECTED
```

## 4. Cross-module seams (one-way, read/limited-write)

- **catalog**: `ProductService.applyRatingAggregate(productId, ratingAvg, ratingCount)`
  (updates the denormalized columns; new repo `updateRating`) + `productExists(id)`
  (validate the target on create).
- **orders**: `OrderService.findPurchasedOrderId(userId, productId)` → orderId |
  null (new repo `findPurchasedOrderId`, query order⋈order_item).
- **ReviewsModule** imports `CatalogModule` + `OrdersModule`; `AuditModule` is
  @Global. Reviews is a leaf (nothing imports it).

## 5. Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/products/:id/reviews` | public | Approved reviews for a product (paginated + summary) |
| POST | `/products/:id/reviews` | buyer | Create a review (verified-purchase auto-detected) |
| PATCH | `/reviews/:id` | owner | Edit own review (→ re-moderation) |
| DELETE | `/reviews/:id` | owner/staff | Delete a review |
| POST | `/reviews/:id/helpful` | buyer | Increment helpful count |
| GET | `/reviews` | staff | Moderation queue (filter by status) |
| PATCH | `/reviews/:id/approve` | staff | Approve |
| PATCH | `/reviews/:id/reject` | staff | Reject |

## 6. Edge cases

| # | Edge case | Handling |
| --- | --- | --- |
| — | Second review by same user | partial-unique → 409 (D56) |
| — | Rating out of range | DTO `@Min(1)@Max(5)` + DB `CHECK (rating BETWEEN 1 AND 5)` |
| — | Unapproved visible publicly | public reads filter `status = APPROVED` (D55) |
| — | Verified purchase | order seam; status not in {PENDING, CANCELLED} (D53) |
| — | Aggregate drift | recomputed from the source-of-truth APPROVED rows on every set change (D54) |
| — | Review a non-existent product | `productExists` → 404 |

## 7. Build order
catalog + orders seams → reviews enum/entity/migration (CHECK + partial-unique) →
repository → DTOs → ReviewService (create+verified detection, moderation,
owner edit/delete, aggregate refresh, helpful) → controller → module + app wiring
→ unit specs (aggregate math, verified detection, moderation visibility) +
app-context boot smoke (capture jest's real exit).

**DoD:** only purchasers get the verified flag; unapproved reviews are hidden
from public; the product rating aggregates correctly on approve/reject/delete;
build + lint + tests + e2e green.
