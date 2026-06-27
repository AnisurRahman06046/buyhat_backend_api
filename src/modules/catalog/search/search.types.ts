import { ProductListItemDto } from '../dto/product-response.dto';

/** DI token for the swappable product search backend (D72). */
export const SEARCH_PROVIDER = 'SEARCH_PROVIDER';

/** One attribute filter: a product matches if it (or an active variant) has any
 * of the chosen options. */
export interface AttributeFilter {
  attributeId: string;
  optionIds: string[];
}

export type ProductSearchSort =
  | 'relevance'
  | 'newest'
  | 'price_asc'
  | 'price_desc';

/** Engine-neutral search criteria (same shape for the PG and ES adapters). */
export interface ProductSearchCriteria {
  q?: string;
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  attributes: AttributeFilter[];
  sort: ProductSearchSort;
  cursor?: string;
  limit: number;
}

export interface OptionFacet {
  optionId: string;
  label: string;
  count: number;
}
export interface AttributeFacet {
  attributeId: string;
  code: string;
  name: string;
  options: OptionFacet[];
}
export interface TermFacet {
  id: string;
  label: string;
  count: number;
}
export interface PriceFacet {
  min: number;
  max: number;
}
export interface ProductSearchFacets {
  attributes: AttributeFacet[];
  brands: TermFacet[];
  categories: TermFacet[];
  price: PriceFacet | null;
}

export interface ProductSearchResult {
  items: ProductListItemDto[];
  facets: ProductSearchFacets;
  nextCursor: string | null;
}

/**
 * Swappable search backend. Callers depend only on this interface, so adopting
 * Elasticsearch later is one adapter + one env var — no caller change (D72).
 * `index`/`remove` are the write path (no-ops for the live Postgres adapter; the
 * ES adapter syncs the index off the catalog outbox).
 */
export interface SearchProvider {
  search(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;
  index(productId: string): Promise<void>;
  remove(productId: string): Promise<void>;
}
