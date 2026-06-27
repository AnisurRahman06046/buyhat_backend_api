# Phase 12 — Search, Faceting & Caching (final phase)

> Faceted product search over the dynamic attribute model, behind a swappable
> `SEARCH_PROVIDER` port so Elasticsearch can drop in later **without breaking
> callers**. Cursor (keyset) pagination for the public catalog. A Redis
> cache-aside layer for hot reads with **single-flight stampede protection**.
> **Depends on:** catalog, cms. **Date:** 2026-06-26. (Search stays Postgres-only
> + live for now; ES adapter is shipped-but-deferred.)

---

## 1. Scope (this round)
- **Search** — `SEARCH_PROVIDER` port; `PostgresSearchProvider` (default,
  verifiable) full-text + filters + **facets**; `ElasticsearchSearchProvider`
  scaffolded behind the same token for future adoption (no caller change).
- **Facets** — over `attribute.is_filterable` attributes, covering **both**
  product-level (`product_attribute_value`) and variant-defining
  (`variant_attribute_value`, e.g. colour/size) values, plus brand / category /
  price-range.
- **Cursor pagination** — keyset for the public product search; offset retained
  for bounded admin lists.
- **Caching** — cache-aside on Redis for homepage / product-detail / category-
  tree with single-flight + jittered TTL + fail-open. **Search is NOT cached**
  (kept live, per decision); its speed comes from indexes.
- **Out of scope this round** (noted, not built): live load-test numbers, ES
  cluster, external metrics/alerting, backups/runbook docs.

## 2. Decisions (continue the D-series)

| # | Decision | Choice |
| --- | --- | --- |
| **D72** | Search backend | **`SEARCH_PROVIDER` port** (Symbol token). `PostgresSearchProvider` default; `ElasticsearchSearchProvider` scaffolded + selected by `SEARCH_DRIVER` env (default `pg`). ES index sync rides the **existing catalog outbox** (`catalog-events`); PG adapter's `index/remove` are no-ops. Callers depend only on the port — adopting ES is one class + one env var. |
| **D73** | Pagination | **Keyset/cursor** for `GET /products/search` — opaque base64 cursor encoding `(sortValue, id)`; fetch `limit+1` for `hasMore`. No total/page-count (facet counts cover "how many"). Offset stays for admin/back-office lists. |
| **D74** | Full-text | **Postgres tsvector**: generated `search_vector` over `name`+`description`, GIN index; `@@ plainto_tsquery` match, `ts_rank` for the `relevance` sort. |
| **D75** | Facetable attrs | `attribute.is_filterable = true`, sourced from PAV (product-level) **and** VAV→variant join (variant-defining). Option label = `label ?? value`, ordered by `position`. Also brand, category, price-range facets. |
| **D76** | Filter semantics | Options **within** one attribute are OR'd; **across** attributes AND'd. Facet counts are **conjunctive** (reflect all active filters); disjunctive facets deferred. |
| **D77** | Caching | **Cache-aside** via `CacheService.getOrSet(key, ttl, loader)`: single-flight Redis lock (`SET NX PX` + Lua compare-and-delete release), losers short-poll then read; **jittered TTL** (±10%) vs synchronized expiry; **fail-open** on any Redis error. Namespaced keys `bh:<module>:<entity>:<id>`; targeted `del` on writes + TTL as the safety net. |
| **D78** | What's cached | `bh:cms:homepage` (~120s, evict on CMS writes), `bh:catalog:product:<slug>` (~300s, evict on product/media/variant change), `bh:catalog:cat:tree` (~600s, evict on category writes). Search uncached. |

## 3. Stampede protection (the 10k-on-one-key case)
`getOrSet` miss path:
```
val = redis.get(key); if val: return val
if redis.set(lock, token, NX, PX=lockTtl):      # winner
    try: val = redis.get(key) ?? loader(); redis.set(key, val, jitter(ttl))
    finally: release(lock, token)               # Lua: del iff value==token
    return val
else:                                            # losers — no DB hit
    repeat few times: sleep(backoff); val = redis.get(key); if val: return val
    return loader()                              # fail-open, bounded by lockTtl
```
Result: ~1 DB query while thousands coalesce; jitter prevents synchronized
expiry; Redis down ⇒ straight to loader (never breaks a request).

## 4. Search query (Postgres adapter)
Criteria: `q?, categoryId?, brandId?, minPrice?, maxPrice?, attrs?(Map<attrId,optId[]>), sort(relevance|newest|price_asc|price_desc), cursor?, limit`.

- **Base predicate** (ACTIVE, not deleted) + optional category/brand/price + FTS
  (`search_vector @@ plainto_tsquery('english', q)`).
- **Attribute filter** (AND across attrs): for each selected attr, `EXISTS` a
  PAV row with a chosen option **OR** an active variant with a VAV chosen option.
- **Page**: keyset predicate on the sort key + `ORDER BY sortKey, id` + `LIMIT n+1`.
- **Facets**: a `matched` CTE (the base predicate, same params) feeds
  `COUNT(DISTINCT product_id)` per (attribute, option) from PAV ∪ VAV-join,
  plus brand/category/price-range aggregates. Only `is_filterable` attributes.
- **Response**: `{ items[], facets{ attributes[], brands[], categories[], price{min,max} }, nextCursor }`.

Endpoint: `GET /products/search` (public). Existing `GET /products` list kept.

## 5. Cross-module / wiring
- Catalog gains `src/modules/catalog/search/` (port + PG adapter + ES stub),
  bound in `CatalogModule`; `ProductService.search()` delegates to the port.
- `@Global CacheModule` (`src/shared/cache/`) exports `CacheService`; CMS +
  catalog inject it for read caching and call `del` on writes. No new infra
  (uses the existing `RedisService` client).

## 6. Migration
`1782520200000-AddProductSearch`: `search_vector` generated column + GIN index;
`idx_vav_attribute_option` on `variant_attribute_value(attribute_id, option_id)`;
supporting index for keyset price sort. (PAV already has `idx_pav_attribute_option`.)

## 7. Build order
migration (FTS + indexes) → cache layer (CacheService + module) → apply caching +
invalidation (cms/catalog) → search port + DTOs + cursor util → PG adapter
(filters + FTS + facets + keyset) → ES stub + driver select + module wiring →
ProductService + controller → specs + e2e + migration run.

**DoD:** faceted `/products/search` returns items + attribute/brand/category/price
facets with cursor paging; hot reads cached with single-flight protection;
swapping in ES needs no caller change; build + lint + tests + e2e green.
