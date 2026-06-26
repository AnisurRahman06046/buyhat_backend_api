# Phase 8 — CMS (homepage builder & content)

> Admin-composable homepage (ordered, drag-to-reorder sections — no code deploy),
> scheduled banners / hero slider, rule-driven popups, announcement bar, and
> landing pages. Public `GET /cms/homepage` returns a **server-hydrated** layout.
> **Depends on:** Phase 0 storage, Phase 2 (catalog), Phase 7 (promotions flash sales).
> **Date:** 2026-06-26. Schema: `DATABASE_SCHEMA.md` §10.

---

## 1. Scope

- **Homepage builder**: ordered `homepage_section` rows (HERO_SLIDER, FLASH_SALE,
  CATEGORY_GRID, FEATURED_PRODUCTS, BRANDS, BANNER, BEST_SELLERS, NEWSLETTER),
  each with a `position`, `is_active`, and a `config` JSONB. Admin reorders via a
  single ordered-id PUT — no redeploy.
- **Banners + hero slider**: `cms_banner` (image + mobile image + CTA + schedule),
  placement-typed (HOME_HERO = hero slides, HOME_STRIP, CATEGORY, ANNOUNCEMENT).
  Hero slides are just banners with `HOME_HERO` placement — no duplicate table.
- **Popups**: `cms_popup` with trigger (ON_LOAD / AFTER_DELAY / EXIT_INTENT /
  ON_SCROLL), frequency (ONCE / EVERY_SESSION / ALWAYS), audience (GUESTS /
  LOGGED_IN / EVERYONE), and a schedule window.
- **Landing pages**: `landing_page` (unique slug, structured JSONB blocks, SEO,
  publish flag).
- **Images**: a CMS-owned multipart upload (`POST /cms/media`) writes to the
  existing `StorageModule` and returns a URL the payloads reference (D47).
- **Public render**: `GET /cms/homepage` overlays each active section with the
  data it needs (banners / flash sales / product / category / brand summaries)
  read one-way from catalog + promotions (D46).

---

## 2. Decisions (continue the D-series)

| # | Decision | Choice |
| --- | --- | --- |
| **D46** | Homepage render depth | **Server-hydrated.** `GET /cms/homepage` returns ordered active sections, each enriched: HERO_SLIDER/BANNER→active `cms_banner`s (same module); FLASH_SALE→active flash sales (`PromotionsService.listActiveFlashSales`); CATEGORY_GRID→category summaries; FEATURED_PRODUCTS/BEST_SELLERS→product summaries (`config.productIds`, manual curation; auto best-sellers = Phase 11); BRANDS→brand summaries; NEWSLETTER→config only. cms→catalog & cms→promotions are **one-way read-only**. |
| **D47** | Images | **Uploaded via CMS.** `POST /cms/media` (multipart, staff) → `StorageModule.putObject` → `{ url, key }`. Banner/popup/section/landing payloads store the returned `url`. Same storage backend as catalog media (local-disk dev / S3 prod). |
| **D48** | Homepage edit model | **Section CRUD + reorder.** Sections are individually created/updated/deleted; `PUT /cms/homepage/order` takes an ordered list of section ids and rewrites `position` in one tx. Active sections in `position` order = the homepage. No draft/publish/versioning (deferred). |
| **D49** | Banner/popup scheduling | **Window-active by timestamp.** Active = `is_active` AND `now ∈ [starts_at, ends_at]` (null bound = open). Public reads filter by the window directly (correct with no sweeper), mirroring flash-sale pricing (Phase 7 D43). |
| **D50** | Popup audience | Server filters by auth state — anonymous gets `GUESTS`+`EVERYONE`, authenticated gets `LOGGED_IN`+`EVERYONE`. `trigger`/`frequency`/`delaySeconds` are returned for **client-side** enforcement. Public popups use `OptionalJwtAuthGuard`. |
| **D51** | Write roles | CMS admin = **ADMIN + MARKETING_MANAGER** (`CMS_WRITE_ROLES`). Public: homepage, active banners, active popups, published landing pages. |
| **D52** | `config` validation | **Shape only.** Per-type DTO validates `config` keys (e.g. `FEATURED_PRODUCTS.productIds: uuid[]`). Referenced ids are **not** existence-checked — CMS must never block on catalog deletes; hydration silently skips missing/inactive ids and renders what remains. |

---

## 3. Schema (`cms` schema; enums as **varchar** per codebase convention)

`homepage_section` (type, title, position, is_active, `config` jsonb) ·
`cms_banner` (title, image_url, mobile_image_url, cta_text, cta_url, placement,
position, starts_at, ends_at, is_active) · `cms_popup` (title, content, image_url,
cta_text, cta_url, trigger, delay_seconds, frequency, audience, starts_at,
ends_at, is_active) · `landing_page` (slug **unique**, title, `content` jsonb,
seo_title, seo_description, is_published). All `SoftDeletableEntity`. Migration
`1782519800000-CreateCmsTables`.

```
HomepageSectionType: HERO_SLIDER | FLASH_SALE | CATEGORY_GRID | FEATURED_PRODUCTS | BRANDS | BANNER | BEST_SELLERS | NEWSLETTER
BannerPlacement:     HOME_HERO | HOME_STRIP | CATEGORY | ANNOUNCEMENT
PopupTrigger:        ON_LOAD | AFTER_DELAY | EXIT_INTENT | ON_SCROLL
PopupFrequency:      ONCE | EVERY_SESSION | ALWAYS
AudienceTarget:      GUESTS | LOGGED_IN | EVERYONE
```

Indexes: `homepage_section(is_active, position)`, `cms_banner(placement, is_active, position)`,
`cms_popup(is_active, starts_at, ends_at)`, `landing_page(slug)` unique.

## 4. Cross-module seams (one-way, read-only)

- **catalog** (export `CategoryService`, `BrandService` from the barrel + module):
  - `ProductService.getProductSummaries(ids)` → `ProductListItemDto[]` (ACTIVE
    only, primary image included, input order preserved).
  - `CategoryService.getCategorySummaries(ids)` → `CategoryResponseDto[]` (active, ordered).
  - `BrandService.getActiveBrands()` / `getBrandSummaries(ids)` → `BrandResponseDto[]`.
- **promotions**: `PromotionsService.listActiveFlashSales()` → `FlashSaleResponseDto[]`
  (delegates to the existing `FlashSaleService.listActive`).
- **CmsModule** imports `CatalogModule`, `PromotionsModule`, `StorageModule` (global).

## 5. Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET/POST/PATCH/DELETE | `/cms/homepage/sections*` | staff | Section CRUD |
| PUT | `/cms/homepage/order` | staff | Reorder sections (ordered id list) |
| GET | `/cms/homepage` | public | **Hydrated** rendered layout |
| GET/POST/PATCH/DELETE | `/cms/banners*` | staff | Banner / hero-slide CRUD |
| GET | `/cms/banners/active?placement=` | public | Active banners for a placement |
| GET/POST/PATCH/DELETE | `/cms/popups*` | staff | Popup CRUD |
| GET | `/cms/popups/active` | public (optional auth) | Audience-filtered active popups |
| GET/POST/PATCH/DELETE | `/cms/landing-pages*` | staff | Landing-page CRUD |
| GET | `/cms/landing-pages/:slug` | public | Published landing page |
| POST | `/cms/media` | staff | Multipart image upload → `{ url, key }` |

## 6. Edge cases

| # | Edge case | Handling |
| --- | --- | --- |
| — | Banner/popup scheduled / expired | Public reads filter `is_active` AND `now ∈ [starts_at, ends_at]` (D49) |
| — | Section references a deleted/inactive product/category | Hydration skips missing ids, renders the rest (D52); never blocks |
| — | Popup targeting | Server returns only audience-matching popups for the caller's auth state (D50) |
| — | Reorder race | `PUT /cms/homepage/order` rewrites positions in one transaction |

## 7. Build order
catalog/promotions seams → cms enums/entities/migration → repos → DTOs (per-type
config shape) → services (Homepage/Banner/Popup/LandingPage admin + `CmsMediaService`
upload + public `CmsService` hydrator) → controllers (admin + public) → module +
app wiring → unit specs (homepage hydration, window/audience filtering) +
app-context boot smoke.

**DoD:** an admin composes & reorders a homepage and schedules a banner/popup
purely via API; an uploaded image shows on the banner; public `GET /cms/homepage`
returns the hydrated layout (active sections in order, embedded
banners/flash-sales/products/categories/brands); build + lint + tests + e2e green.
