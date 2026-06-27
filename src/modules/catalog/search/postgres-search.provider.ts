import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProductListItemDto } from '../dto/product-response.dto';
import { ProductStatus } from '../enums/product-status.enum';
import { decodeCursor, encodeCursor } from './cursor.util';
import {
  AttributeFacet,
  PriceFacet,
  ProductSearchCriteria,
  ProductSearchResult,
  SearchProvider,
  TermFacet,
} from './search.types';

interface PageRow {
  id: string;
  name: string;
  slug: string;
  base_price: string | null;
  currency: string;
  rating_avg: string;
  rating_count: number;
  category_id: string;
  category_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  image_url: string | null;
  created_at: Date;
  rank?: number;
}

interface AttrFacetRow {
  attribute_id: string;
  code: string;
  name: string;
  option_id: string;
  label: string;
  count: string;
}
interface TermFacetRow {
  id: string;
  label: string;
  count: string;
}
interface PriceFacetRow {
  min: string | null;
  max: string | null;
}

/** Builds the shared base-filter WHERE body (placeholders from $1). */
interface BaseFilter {
  sql: string;
  params: unknown[];
  qIndex: number | null;
}

/**
 * Default, live search backend (D72): Postgres full-text (`search_vector` +
 * GIN), filters, keyset pagination, and conjunctive facets over the dynamic
 * attribute model — product-level (PAV) and variant-defining (VAV) — plus brand,
 * category and price-range. No index to maintain, so `index`/`remove` are no-ops.
 */
@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  constructor(private readonly dataSource: DataSource) {}

  index(): Promise<void> {
    return Promise.resolve();
  }
  remove(): Promise<void> {
    return Promise.resolve();
  }

  async search(c: ProductSearchCriteria): Promise<ProductSearchResult> {
    const base = this.buildBase(c);
    const [items, facets] = await Promise.all([
      this.page(c, base),
      this.facets(base),
    ]);
    return { items: items.items, facets, nextCursor: items.nextCursor };
  }

  // --- base predicate --------------------------------------------------------

  private buildBase(c: ProductSearchCriteria): BaseFilter {
    const clauses = ["p.status = 'ACTIVE'", 'p.deleted_at IS NULL'];
    const params: unknown[] = [];
    let qIndex: number | null = null;
    const add = (v: unknown): number => params.push(v);

    if (c.q && c.q.trim()) {
      qIndex = add(c.q.trim());
      clauses.push(`p.search_vector @@ plainto_tsquery('english', $${qIndex})`);
    }
    if (c.categoryId)
      clauses.push(`p.category_id = $${add(c.categoryId)}::uuid`);
    if (c.brandId) clauses.push(`p.brand_id = $${add(c.brandId)}::uuid`);
    if (c.minPrice != null) clauses.push(`p.base_price >= $${add(c.minPrice)}`);
    if (c.maxPrice != null) clauses.push(`p.base_price <= $${add(c.maxPrice)}`);

    for (const f of c.attributes) {
      if (f.optionIds.length === 0) continue;
      const a = add(f.attributeId);
      const o = add(f.optionIds);
      clauses.push(
        `(EXISTS (SELECT 1 FROM catalog.product_attribute_value pav
            WHERE pav.product_id = p.id AND pav.attribute_id = $${a}::uuid
              AND pav.option_id = ANY($${o}::uuid[]))
          OR EXISTS (SELECT 1 FROM catalog.product_variant pv
            JOIN catalog.variant_attribute_value vav ON vav.variant_id = pv.id
            WHERE pv.product_id = p.id AND pv.is_active = true
              AND vav.attribute_id = $${a}::uuid
              AND vav.option_id = ANY($${o}::uuid[])))`,
      );
    }
    return { sql: clauses.join(' AND '), params, qIndex };
  }

  // --- page (keyset) ---------------------------------------------------------

  private async page(
    c: ProductSearchCriteria,
    base: BaseFilter,
  ): Promise<{ items: ProductListItemDto[]; nextCursor: string | null }> {
    const params = [...base.params];
    const add = (v: unknown): number => params.push(v);
    const cursor = c.cursor ? decodeCursor(c.cursor) : null;

    const rankExpr = base.qIndex
      ? `ts_rank(p.search_vector, plainto_tsquery('english', $${base.qIndex}))`
      : '0';

    let rankSelect = '';
    let orderBy: string;
    let keyset = '';

    switch (c.sort) {
      case 'relevance': {
        rankSelect = `, ${rankExpr} AS rank`;
        orderBy = `${rankExpr} DESC, p.id DESC`;
        if (cursor) {
          const r = add(cursor.v);
          const id = add(cursor.id);
          keyset = `AND (${rankExpr} < $${r} OR (${rankExpr} = $${r} AND p.id < $${id}::uuid))`;
        }
        break;
      }
      case 'price_asc': {
        orderBy = 'COALESCE(p.base_price, 0) ASC, p.id ASC';
        if (cursor) {
          const v = add(cursor.v);
          const id = add(cursor.id);
          keyset = `AND (COALESCE(p.base_price, 0) > $${v} OR (COALESCE(p.base_price, 0) = $${v} AND p.id > $${id}::uuid))`;
        }
        break;
      }
      case 'price_desc': {
        orderBy = 'COALESCE(p.base_price, 0) DESC, p.id DESC';
        if (cursor) {
          const v = add(cursor.v);
          const id = add(cursor.id);
          keyset = `AND (COALESCE(p.base_price, 0) < $${v} OR (COALESCE(p.base_price, 0) = $${v} AND p.id < $${id}::uuid))`;
        }
        break;
      }
      default: {
        orderBy = 'p.created_at DESC, p.id DESC';
        if (cursor) {
          const v = add(cursor.v);
          const id = add(cursor.id);
          keyset = `AND (p.created_at < $${v}::timestamptz OR (p.created_at = $${v}::timestamptz AND p.id < $${id}::uuid))`;
        }
        break;
      }
    }

    const limitIdx = add(c.limit + 1);
    const sql = `
      SELECT p.id, p.name, p.slug, p.base_price, p.currency,
             p.rating_avg, p.rating_count,
             p.category_id, c.name AS category_name,
             p.brand_id, b.name AS brand_name,
             (SELECT m.url FROM catalog.product_media m
                WHERE m.product_id = p.id AND m.is_primary = true LIMIT 1) AS image_url,
             p.created_at ${rankSelect}
      FROM catalog.product p
      LEFT JOIN catalog.category c ON c.id = p.category_id
      LEFT JOIN catalog.brand b ON b.id = p.brand_id
      WHERE ${base.sql} ${keyset}
      ORDER BY ${orderBy}
      LIMIT $${limitIdx}`;

    const rows = await this.dataSource.query<PageRow[]>(sql, params);
    const hasMore = rows.length > c.limit;
    const pageRows = hasMore ? rows.slice(0, c.limit) : rows;
    const items = pageRows.map((r) => this.toItem(r));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      nextCursor = encodeCursor({
        v: this.cursorValue(c.sort, last),
        id: last.id,
      });
    }
    return { items, nextCursor };
  }

  private cursorValue(
    sort: ProductSearchCriteria['sort'],
    row: PageRow,
  ): string | number {
    switch (sort) {
      case 'relevance':
        return Number(row.rank ?? 0);
      case 'price_asc':
      case 'price_desc':
        return Number(row.base_price ?? 0);
      default:
        return new Date(row.created_at).toISOString();
    }
  }

  private toItem(r: PageRow): ProductListItemDto {
    const dto = new ProductListItemDto();
    dto.id = r.id;
    dto.name = r.name;
    dto.slug = r.slug;
    dto.status = ProductStatus.ACTIVE;
    dto.basePrice = r.base_price != null ? Number(r.base_price) : null;
    dto.currency = r.currency;
    dto.ratingAvg = Number(r.rating_avg);
    dto.ratingCount = Number(r.rating_count);
    dto.categoryId = r.category_id;
    dto.categoryName = r.category_name ?? null;
    dto.brandId = r.brand_id ?? null;
    dto.brandName = r.brand_name ?? null;
    dto.imageUrl = r.image_url ?? null;
    return dto;
  }

  // --- facets (conjunctive, over the matched set) ----------------------------

  private async facets(
    base: BaseFilter,
  ): Promise<ProductSearchResult['facets']> {
    const cte = `WITH matched AS (SELECT p.id FROM catalog.product p WHERE ${base.sql})`;
    const [attrRows, brandRows, catRows, priceRows] = await Promise.all([
      this.dataSource.query<AttrFacetRow[]>(
        `${cte}
         SELECT a.id AS attribute_id, a.code, a.name, o.id AS option_id,
                COALESCE(o.label, o.value) AS label, o.position, SUM(f.cnt)::int AS count
         FROM (
           SELECT pav.attribute_id, pav.option_id, COUNT(DISTINCT pav.product_id) AS cnt
           FROM catalog.product_attribute_value pav
           WHERE pav.product_id IN (SELECT id FROM matched) AND pav.option_id IS NOT NULL
           GROUP BY pav.attribute_id, pav.option_id
           UNION ALL
           SELECT vav.attribute_id, vav.option_id, COUNT(DISTINCT pv.product_id) AS cnt
           FROM catalog.variant_attribute_value vav
           JOIN catalog.product_variant pv ON pv.id = vav.variant_id
           WHERE pv.product_id IN (SELECT id FROM matched) AND pv.is_active = true
           GROUP BY vav.attribute_id, vav.option_id
         ) f
         JOIN catalog.attribute a ON a.id = f.attribute_id
            AND a.is_filterable = true AND a.deleted_at IS NULL
         JOIN catalog.attribute_option o ON o.id = f.option_id
         GROUP BY a.id, a.code, a.name, o.id, o.label, o.value, o.position
         ORDER BY a.name ASC, o.position ASC`,
        base.params,
      ),
      this.dataSource.query<TermFacetRow[]>(
        `${cte}
         SELECT p.brand_id AS id, b.name AS label, COUNT(*)::int AS count
         FROM catalog.product p JOIN matched m ON m.id = p.id
         JOIN catalog.brand b ON b.id = p.brand_id
         WHERE p.brand_id IS NOT NULL
         GROUP BY p.brand_id, b.name ORDER BY count DESC`,
        base.params,
      ),
      this.dataSource.query<TermFacetRow[]>(
        `${cte}
         SELECT p.category_id AS id, c.name AS label, COUNT(*)::int AS count
         FROM catalog.product p JOIN matched m ON m.id = p.id
         JOIN catalog.category c ON c.id = p.category_id
         GROUP BY p.category_id, c.name ORDER BY count DESC`,
        base.params,
      ),
      this.dataSource.query<PriceFacetRow[]>(
        `${cte}
         SELECT MIN(p.base_price) AS min, MAX(p.base_price) AS max
         FROM catalog.product p JOIN matched m ON m.id = p.id`,
        base.params,
      ),
    ]);

    return {
      attributes: this.groupAttrFacets(attrRows),
      brands: brandRows.map((r) => this.toTerm(r)),
      categories: catRows.map((r) => this.toTerm(r)),
      price: this.toPrice(priceRows[0]),
    };
  }

  private groupAttrFacets(rows: AttrFacetRow[]): AttributeFacet[] {
    const byAttr = new Map<string, AttributeFacet>();
    for (const r of rows) {
      let facet = byAttr.get(r.attribute_id);
      if (!facet) {
        facet = {
          attributeId: r.attribute_id,
          code: r.code,
          name: r.name,
          options: [],
        };
        byAttr.set(r.attribute_id, facet);
      }
      facet.options.push({
        optionId: r.option_id,
        label: r.label,
        count: Number(r.count),
      });
    }
    return [...byAttr.values()];
  }

  private toTerm(r: TermFacetRow): TermFacet {
    return { id: r.id, label: r.label, count: Number(r.count) };
  }

  private toPrice(row: PriceFacetRow | undefined): PriceFacet | null {
    if (!row || row.min == null || row.max == null) return null;
    return { min: Number(row.min), max: Number(row.max) };
  }
}
