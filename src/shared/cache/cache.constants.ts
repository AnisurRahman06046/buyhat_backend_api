/**
 * Namespaced cache keys (`bh:<module>:<entity>:<id>`) so evictions are precise
 * and a prefix can be SCAN-deleted for collection-wide busts.
 */
export const CACHE_KEYS = {
  homepage: (): string => 'bh:cms:homepage',
  productBySlug: (slug: string): string => `bh:catalog:product:${slug}`,
  /** Prefix covering every cached product detail — for collection-wide busts. */
  productPrefix: (): string => 'bh:catalog:product:',
  categoryTree: (): string => 'bh:catalog:cat:tree',
} as const;

/** Default TTLs (seconds); overridable via the `cache` config namespace. */
export const CACHE_TTL_DEFAULTS = {
  homepage: 120,
  productDetail: 300,
  categoryTree: 600,
} as const;

/** Single-flight lock lifetime — long enough for a slow loader, short enough
 * that a crashed winner can't wedge the key for long. */
export const CACHE_LOCK_TTL_MS = 5_000;

/** Loser wait loop while the winner recomputes. */
export const CACHE_WAIT_TRIES = 20;
export const CACHE_WAIT_BACKOFF_MS = 50;
