import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Thin, typed wrapper around a single shared ioredis client.
 *
 * Exposes the common operations (get/set/del/ttl) plus `getClient()` for
 * advanced use (pub/sub, pipelines, Lua scripts). Using ioredis directly avoids
 * the cache-manager v5/v6 churn and gives full control over the client.
 *
 * Values are JSON-serialized by `set` and parsed by `get<T>()`.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /** Underlying ioredis client for advanced operations. */
  getClient(): Redis {
    return this.client;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Stored as a plain string.
      return raw as unknown as T;
    }
  }

  /**
   * Set a value with an optional TTL (seconds).
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    return this.client.del(...keys);
  }

  /** Remaining TTL in seconds (-2 = no key, -1 = no expiry). */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (err) {
      this.logger.warn(`Error closing Redis connection: ${String(err)}`);
    }
  }
}
