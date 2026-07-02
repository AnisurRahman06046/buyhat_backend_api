import { Injectable } from '@nestjs/common';

/**
 * MVP: Redis-free no-op cache.
 *
 * The initial launch runs without Redis, so there is no cache-aside layer:
 * `getOrSet` always runs the loader (every read hits the source of truth) and
 * `del`/`delByPrefix` are no-ops. This keeps every cache-aside call site
 * (homepage, product detail, category tree, search) working with zero wiring
 * changes. Restore the Redis-backed single-flight version (see git history) when
 * re-enabling caching.
 */
@Injectable()
export class CacheService {
  /** No cache: always compute via the loader. */
  getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    return loader();
  }

  /** No-op — nothing is cached to evict. */
  del(...keys: string[]): Promise<void> {
    void keys;
    return Promise.resolve();
  }

  /** No-op — nothing is cached to evict. */
  delByPrefix(prefix: string): Promise<void> {
    void prefix;
    return Promise.resolve();
  }
}
