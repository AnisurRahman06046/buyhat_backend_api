import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Thin JSON cache over the shared Redis client. Keys are automatically
 * namespaced by the client's `keyPrefix` (see RedisModule).
 */
@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, payload);
    }
  }

  async del(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /** Cache-aside helper: return cached value or compute, store and return it. */
  async wrap<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /** Escape hatch for advanced commands (pipelines, pub/sub, etc.). */
  get client(): Redis {
    return this.redis;
  }
}
