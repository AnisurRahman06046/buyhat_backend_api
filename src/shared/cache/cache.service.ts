import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisService } from '../redis/redis.service';
import {
  CACHE_LOCK_TTL_MS,
  CACHE_WAIT_BACKOFF_MS,
  CACHE_WAIT_TRIES,
} from './cache.constants';

/** Lua: delete the lock only if we still own it (compare-and-delete). */
const RELEASE_LOCK_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cache-aside layer over Redis with **single-flight** stampede protection.
 *
 * `getOrSet` coalesces a thundering herd: on a miss exactly one caller (the lock
 * winner) recomputes while the rest short-poll and read its result — so a hot
 * key that expires under heavy load triggers ~1 loader call, not thousands.
 * TTLs are **jittered** (±10%) to avoid synchronized expiry, and every Redis op
 * is **fail-open**: any cache error falls through to the loader so the cache can
 * never break a request.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(redis: RedisService) {
    this.client = redis.getClient();
  }

  /**
   * Return the cached value for `key`, or compute it via `loader`, cache it
   * (jittered `ttlSeconds`) and return it. Null/undefined loader results are
   * returned but not cached (no negative caching).
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.safeGet<T>(key);
    if (cached !== null) return cached;
    return this.computeWithLock(key, ttlSeconds, loader);
  }

  /** Evict one or more keys (best-effort). */
  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`cache del failed: ${String(err)}`);
    }
  }

  /** Evict every key matching `prefix*` via SCAN (best-effort, non-blocking). */
  async delByPrefix(prefix: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, batch] = await this.client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (batch.length > 0) await this.client.del(...batch);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`cache delByPrefix(${prefix}) failed: ${String(err)}`);
    }
  }

  // --- internals -------------------------------------------------------------

  private async computeWithLock<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const lockKey = `${key}:lock`;
    const token = randomUUID();
    const acquired = await this.tryAcquire(lockKey, token);

    if (acquired) {
      try {
        // Someone may have filled the cache between our miss and the lock.
        const again = await this.safeGet<T>(key);
        if (again !== null) return again;
        const value = await loader();
        if (value !== null && value !== undefined) {
          await this.safeSet(key, value, ttlSeconds);
        }
        return value;
      } finally {
        await this.releaseLock(lockKey, token);
      }
    }

    // Loser: don't hit the loader — wait for the winner to publish the value.
    for (let i = 0; i < CACHE_WAIT_TRIES; i++) {
      await sleep(CACHE_WAIT_BACKOFF_MS);
      const value = await this.safeGet<T>(key);
      if (value !== null) return value;
    }
    // Winner too slow / crashed (lock TTL bounds this): fail-open and compute.
    return loader();
  }

  private async tryAcquire(lockKey: string, token: string): Promise<boolean> {
    try {
      const res = await this.client.set(
        lockKey,
        token,
        'PX',
        CACHE_LOCK_TTL_MS,
        'NX',
      );
      return res === 'OK';
    } catch {
      // Redis unavailable → treat as "not acquired"; caller falls through.
      return false;
    }
  }

  private async releaseLock(lockKey: string, token: string): Promise<void> {
    try {
      await this.client.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
    } catch (err) {
      this.logger.warn(`cache lock release failed: ${String(err)}`);
    }
  }

  private async safeGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null; // fail-open: treat as a miss
    }
  }

  private async safeSet(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.client.set(
        key,
        JSON.stringify(value),
        'EX',
        this.jitter(ttlSeconds),
      );
    } catch (err) {
      this.logger.warn(`cache set failed for ${key}: ${String(err)}`);
    }
  }

  /** ±10% jitter so many keys with the same TTL don't expire in lockstep. */
  private jitter(ttlSeconds: number): number {
    const delta = ttlSeconds * 0.1;
    return Math.max(
      1,
      Math.round(ttlSeconds - delta + Math.random() * 2 * delta),
    );
  }
}
