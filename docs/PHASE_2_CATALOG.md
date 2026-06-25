# Phase 2 — Catalog (design)

> Plan, dynamic-attribute model, variant-generation algorithm, API, and edge
> cases for the Catalog module. Read with `PROJECT_PLAN.md` (roadmap) and
> `DATABASE_SCHEMA.md §4` (entities). Builds on the completed Phases 0–1.
>
> **Date:** 2026-06-25 · **Status:** **implemented & verified** (incl. media step).
> Decisions D7–D12 resolved 2026-06-25 (see §10). Only follow-up left:
> `variant.created` outbox → inventory (Phase 3).

---

## 1. Scope

**In scope**
- **Categories** — nested tree, CRUD, per-category attribute assignment.
- **Attributes** — global, typed, with options; `is_variant_defining` flag.
- **Brands** — CRUD.
- **Products** — CRUD, slugs, **publishing lifecycle** (DRAFT/ACTIVE/ARCHIVED),
  inherited attributes, attribute values.
- **Variants** — **auto-generated from attribute-option combinations**, plus
  manual add; SKU/price/barcode/weight.
- **Media** — product/variant images via **S3/MinIO** (the storage adapter
  deferred from Phase 0 lands here).
- Public read endpoints (only `ACTIVE` products) + admin write endpoints.

**Out of scope (later phases)**
- Stock/quantities → **inventory (Phase 3)**; catalog defines the variant, not its stock.
- Pricing rules / flash-sale overrides → promotions (Phase 7).
- Full-text search + faceted search engine → **Elasticsearch (Phase 12)**;
  Phase 2 ships DB-level filtering only.

**The special requirement** (categories define attributes → products inherit →
variants auto-generate) is detailed in §3 — it is the heart of this phase.

---

## 2. Data model (catalog schema)

Entities are defined in `DATABASE_SCHEMA.md §4`; Phase 2 refinements below.

| Entity | Role |
| --- | --- |
| `category` | tree (`parent_id` + `materialized_path`), slug, position, is_active |
| `brand` | name, slug, logo |
| `attribute` | code, `type` (STRING/NUMBER/BOOLEAN/SELECT/MULTISELECT), `unit`, `is_variant_defining`, `is_filterable` |
| `attribute_option` | values for SELECT/MULTISELECT (Red, S, M …) |
| `category_attribute` | which attributes apply to a category (`is_required`, `position`) |
| `product` | category_id, brand_id, status, slug, base_price?, rating_avg/count |
| `product_attribute_value` | a product's **non-variant** attribute values |
| `product_variant` | sku, barcode, price, weight, is_active, **`attribute_signature`** |
| `variant_attribute_value` | a variant's variant-defining (attribute → option) pairs |
| `product_media` | images/video for a product or specific variant |

**Phase 2 schema refinements (over §4):**
1. **`product_variant.attribute_signature`** (`varchar`) + **unique
   `(product_id, attribute_signature)`** — a canonical, ordered hash of the
   variant's `attributeId:optionId` pairs. Makes variant generation **idempotent**
   and makes "no duplicate combination per product" a DB invariant (edge case).
   A simple/no-variant product uses signature `''`.
2. **`category.parent_id` `ON DELETE RESTRICT`** and **`product.category_id`
   `ON DELETE RESTRICT`** (edge case #4 — archive, never cascade-delete).
3. `attribute.code`, `product.slug`, `category.slug`, `brand.slug`,
   `product_variant.sku` are unique; `product_variant.barcode` partial-unique.

Migration: `CreateCatalogTables` (all catalog tables in dependency order:
attribute → attribute_option → brand → category → category_attribute → product →
product_attribute_value → product_variant → variant_attribute_value → product_media).

---

## 3. Dynamic attributes & automatic variant generation

This satisfies "no hardcoded product types — supports any future category."

### 3.1 Attribute inheritance (category → product)
A product's **applicable attributes** = the union of `category_attribute` rows
for the product's category **and all its ancestors** (walk `parent_id` up the
tree). Example:

```
Clothing            → Size (variant), Color (variant), Material (non-variant)
└─ Men's Shirts     → Collar Type (non-variant)
Product "Oxford Shirt" in Men's Shirts inherits:
   Size, Color, Material, Collar Type
```
`AttributeResolverService.resolveForCategory(categoryId)` returns the merged,
de-duplicated, ordered list (child overrides ancestor on `is_required`/position).

### 3.2 Two kinds of attribute value
- **Variant-defining** (`is_variant_defining = true`, must be SELECT/MULTISELECT):
  drive variant generation (Size, Color). The product declares **which options it
  offers** per such attribute.
- **Non-variant**: stored once per product in `product_attribute_value`
  (Material = Cotton, Collar = Spread).

### 3.3 Variant generation (the algorithm)
`POST /products/:id/variants` with a **generation request**:
```jsonc
{
  "options": {                       // variant-defining attribute code → option ids
    "size":  ["<opt-S>", "<opt-M>", "<opt-L>"],
    "color": ["<opt-red>", "<opt-blue>"]
  },
  "defaults": { "price": 1200, "weight": 0.25 },     // applied to every new variant
  "overrides": [                                       // optional per-combination tweaks
    { "match": { "size": "<opt-L>", "color": "<opt-red>" }, "price": 1300, "sku": "OXF-RED-L" }
  ]
}
```
Steps:
1. Load product + category; resolve applicable attributes (§3.1).
2. Validate each key is an **applicable, variant-defining** attribute and each
   option id **belongs to that attribute**.
3. **Cartesian product** of the option lists → combinations
   (3 sizes × 2 colors = 6).
4. **Guard:** reject if combinations > `MAX_VARIANTS_PER_GENERATION` (default 200).
5. For each combination, compute `attribute_signature` (sorted
   `attrId:optionId` joined). If a variant with that signature already exists →
   **skip** (idempotent); else create `product_variant` + its
   `variant_attribute_value` rows in one transaction.
6. **SKU**: from override, else auto `{<slug-prefix>}-{optionValues}` (e.g.
   `oxford-shirt-red-l`), uniquified on collision.
7. Return `{ created: N, skipped: M, variants: [...] }`.

**D8 (resolved):** the endpoint *only* generates from `options` (cartesian). A
single variant = supplying one option id per axis; there is no separate explicit
`{ variant: {...} }` body.

> Stock is **not** set here. Each new variant is announced to inventory (Phase 3)
> via an outbox event `variant.created` so a `stock_item` (qty 0) is provisioned.
> Until Phase 3 ships, that event is a no-op consumer.

---

## 4. Publishing system

`product.status`: `DRAFT → ACTIVE → ARCHIVED` (and `ARCHIVED → ACTIVE` restore).

- **Publish (`POST /products/:id/publish`) preconditions** — 422 with a list of
  what's missing if not met:
  - has category + name + slug;
  - every **required** applicable attribute has a value;
  - if the category has variant-defining attributes → **≥1 active variant**;
    otherwise → `base_price` set;
  - **≥1 image (D11 resolved: BLOCK — publish returns 422 if the product has no image).**
- **Public visibility:** `GET /products` and `/products/:slug` return only
  `ACTIVE`, non-deleted products. Admin/staff endpoints see all statuses.
- `DELETE /products/:id` = soft-delete + archive (never hard-delete — products
  are referenced by orders later).

---

## 5. Media & storage (local disk ↔ S3, swappable) — built AFTER the rest

Deferred from Phase 0 and built **last** (separate from the rest of catalog).
`StorageModule` (`@Global`) binds a `STORAGE_PROVIDER` token to one of two
adapters chosen by `STORAGE_DRIVER` env:
- **`local` (default)** — `LocalDiskStorageProvider`: writes under `STORAGE_LOCAL_ROOT`
  (e.g. `./storage/uploads`), served via a static route / `STORAGE_PUBLIC_URL`.
  Good for a single VPS.
- **`s3`** — `S3StorageProvider` (AWS SDK v3, MinIO-compatible via `endpoint` +
  `forcePathStyle`): `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`,
  `S3_SECRET_KEY`, `S3_PUBLIC_URL`.

Both implement the same port (`putObject`/`getPublicUrl`/`createPresignedPut`/
`deleteObject`), so swapping is a one-env-var change. The `product_media` table,
entity, and `/products/:id/media*` endpoints land in this media step too.

**Upload flow — D7 (resolved: server-proxied multipart default):**
1. `POST /products/:id/media` (Nest `FileInterceptor` → stream to the
   `STORAGE_PROVIDER` port → `putObject`). Validate content-type (image/\*) and
   size; record the `product_media` row in the same request. Works identically
   for the local-disk (dev default) and S3 drivers.
2. `isPrimary` is unique per product (partial index / clear-others-in-tx, like
   default addresses); `variantId` optionally scopes the image to a variant.

**Presign kept on the port for later:** `createPresignedPut` stays on the storage
port; a `POST /products/:id/media/presign` → `{ uploadUrl, key }` endpoint (then
record via `POST /products/:id/media { key, ... }`) can be exposed for S3 direct
uploads when large-file/scale needs arrive. **Not the default path.**

**Infra (resolved):** dev uses the **local-disk driver** (no MinIO container); the
**S3 adapter is still built** for prod (`@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner`), selected by `STORAGE_DRIVER`.

---

## 6. API design

> Phase 0 envelope. Public = no auth; 🔒 = token; admin writes =
> `@Roles(...CATALOG_WRITE_ROLES)` = **ADMIN + MARKETING_MANAGER** (D12 resolved).
> Public list endpoints are cached later (Phase 12).

### Categories (`/api/v1/categories`)
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/categories` | public | tree (or `?flat=true`) |
| GET | `/categories/:idOrSlug` | public | one category |
| GET | `/categories/:id/attributes` | public | resolved inherited attributes |
| POST | `/categories` | admin | create (parent optional) |
| PUT | `/categories/:id` | admin | update |
| DELETE | `/categories/:id` | admin | archive (blocked if children/products — #4) |
| POST | `/categories/:id/attributes` | admin | assign attribute (`{ attributeId, isRequired }`) |
| DELETE | `/categories/:id/attributes/:attributeId` | admin | unassign |

### Attributes (`/api/v1/attributes`)
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/attributes` | admin | list (filter by type/variant-defining) |
| POST | `/attributes` | admin | create |
| PUT | `/attributes/:id` | admin | update |
| DELETE | `/attributes/:id` | admin | delete (blocked if in use) |
| GET | `/attributes/:id/options` | admin | list options |
| POST | `/attributes/:id/options` | admin | add option |

### Brands (`/api/v1/brands`)
`GET` (public), `POST/PUT/DELETE` (admin).

### Products (`/api/v1/products`)
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/products` | public | paginated; filters: `category`, `brand`, `attr[code]=optId`, `minPrice/maxPrice`, `q`, `sort`. **ACTIVE only** |
| GET | `/products/:slug` | public | full detail (variants + attributes + media). ACTIVE only |
| POST | `/products` | admin | create (DRAFT) |
| PUT | `/products/:id` | admin | update |
| DELETE | `/products/:id` | admin | archive (soft delete) |
| POST | `/products/:id/publish` | admin | DRAFT/ARCHIVED → ACTIVE (validates) |
| POST | `/products/:id/unpublish` | admin | ACTIVE → ARCHIVED |
| GET | `/products/:id` | admin | detail any status (admin view) |
| POST | `/products/:id/variants` | admin | **generate** / add variants (§3.3) |
| GET | `/products/:id/variants` | admin | list variants |
| POST | `/products/:id/attribute-values` | admin | set non-variant attribute values |
| POST | `/products/:id/media/presign` | admin | presigned upload URL |
| POST | `/products/:id/media` | admin | record/upload media |

### Variants & media
`PUT /variants/:id` (admin, price/sku/barcode/weight/isActive),
`DELETE /variants/:id` (admin, blocked/soft if referenced by orders later),
`DELETE /media/:id` (admin).

---

## 7. Edge-case scenarios

| # | Scenario | Handling |
| --- | --- | --- |
| C1 | **Delete category with products/children** (#4) | `ON DELETE RESTRICT` + service guard → 409; archive (`is_active=false`) instead |
| C2 | **Variant-level stock** (#5) | catalog stores no stock; inventory keys on `variant_id`. `variant.created` outbox event provisions a stock row in Phase 3 |
| C3 | **Duplicate variant combination** | `attribute_signature` unique `(product_id, signature)` → generation skips existing |
| C4 | **Cartesian explosion** | reject generation when combinations > 200 (configurable) |
| C5 | **Non-SELECT attribute marked variant-defining** | validation: variant-defining requires SELECT/MULTISELECT |
| C6 | **Option id not belonging to the attribute** | validated before generation → 400 |
| C7 | **Slug collisions** | auto-slugify from name; on collision append `-2`, `-3`… ; slug unique |
| C8 | **SKU collision** | auto-SKU uniquified; explicit duplicate SKU → 409 (unique index) |
| C9 | **Category attributes changed after products exist** | applies to *new* resolutions/generation only; existing variants untouched |
| C10 | **Delete attribute still in use** | RESTRICT via category_attribute / product_attribute_value / variant refs → 409 |
| C11 | **Publish incomplete product** | 422 with the precise unmet preconditions (§4) |
| C12 | **Public sees DRAFT/archived** | public queries filter `status = ACTIVE AND deleted_at IS NULL` |
| C13 | **Primary image** | one primary per product (partial unique / clear-in-tx) |
| C14 | **Product referenced by an order, later archived** | soft-delete only; order snapshots already hold name/price/sku (Phase 5) |
| C15 | **Concurrent product/variant edits** | `version` optimistic lock on product & variant |

---

## 8. Build order

1. `StorageModule` + `S3StorageProvider` + storage config/env (`@aws-sdk/client-s3`).
2. Entities + `CreateCatalogTables` migration (+ `attribute_signature`).
3. Repositories (category, attribute, brand, product, variant, media) on `BaseRepository`.
4. `AttributeResolverService` (inheritance walk) + `SlugService` + `SkuService`.
5. Attributes + options CRUD; Brands CRUD; Categories CRUD + tree + attribute assignment.
6. Products CRUD + publishing; product attribute-values.
7. **Variant generation** service (cartesian + signature + idempotency) + endpoints.
8. Media: presign + record (+ `variantId` scoping, primary handling).
9. Public read endpoints with filtering/pagination; admin views.
10. Outbox `variant.created` (+ no-op consumer until Phase 3).
11. Tests: unit (resolver, cartesian generation, slug/sku, publish validation) +
    live smoke (category→attributes→product→generate variants→publish→public GET).

---

## 9. Definition of Done

- Create a category with attributes, a product inheriting them, and **auto-generate
  variants** from option combinations — entirely via API, no code changes.
- Re-running generation is idempotent (no duplicate combinations).
- Publish enforces preconditions; public endpoints expose only ACTIVE products
  with variants, attributes, and images.
- Category delete is blocked when non-empty; media upload works against MinIO.
- Unit + smoke tests green; migration applies cleanly.

---

## 10. Decisions (resolved 2026-06-25)

| # | Decision | Resolution |
| --- | --- | --- |
| D7 | Media upload | **Server-proxied multipart** as the default (one `POST .../media` streams to the storage port; works for local-disk + S3). `createPresignedPut` stays on the port + an optional presign endpoint for S3 direct uploads later. |
| D8 | `POST /products/:id/variants` | **Generate from `options` (cartesian) only** — no separate explicit-variant body; a single variant = one option per axis. *(as built)* |
| D9 | Attribute inheritance | **Category + all ancestors**, nearest-ancestor wins. *(as built)* |
| D10 | `MAX_VARIANTS_PER_GENERATION` | **200**, and **make it env-configurable** (currently a hardcoded const in `variant.service.ts`). |
| D11 | Publish requires ≥1 image | **BLOCK** — `publishErrors()` adds an image check; publish returns 422 if the product has no image. *(to build with media)* |
| D12 | Catalog write roles | **ADMIN + MARKETING_MANAGER** (`CATALOG_WRITE_ROLES`). *(as built)* |
| Infra | Local media infra | **Local-disk driver for dev** (no MinIO container); **S3 adapter still shipped** for prod (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`), selected by `STORAGE_DRIVER`. |

**Media step — DONE (2026-06-25):** `ProductMedia` entity + `CreateCatalogMedia`
migration (applied); `@Global StorageModule` binding `STORAGE_PROVIDER` to
`LocalDiskStorageProvider` (default) or `S3StorageProvider` by `STORAGE_DRIVER`;
`/products/:id/media` (multipart upload), `/media`, `/media/presign` +
`/media/record` (S3 path), `PUT/DELETE /media/:id`; single-primary + first-image
auto-primary; `variantId` scoping; local files served at `/uploads`. D11 image
check wired into `publishErrors()`; D10 lifted to
`CATALOG_MAX_VARIANTS_PER_GENERATION`. Verified: build + lint + 21 unit tests +
app-context DI smoke green; migration applied to local PG.

**Remaining (deferred, not a Phase 2 gap):** `variant.created` outbox event →
inventory consumer in **Phase 3**.
